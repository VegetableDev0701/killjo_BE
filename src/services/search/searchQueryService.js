const { Pool } = require('pg');
const DatabaseSearchService = require("./databaseSearchService");




const searchPool = new Pool({
  connectionString: process.env.LISTING_URL,
  ssl: false, 
});

class SearchQueryService {
  

  generateSearchId(query, category) {

    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedCategory = (category || 'auto').toLowerCase().trim();
    
    const queryHash = require('crypto').createHash('md5').update(`${normalizedQuery}:${normalizedCategory}`).digest('hex');
    return queryHash.substring(0, 8); // Use first 8 characters
  }

  async storeSearchQuery(searchData) {
    try {
      let {
        searchId, originalQuery, normalizeQuery, listingVectorJsonArray, scrapedVectorJsonArray, category,
        filters, totalListing, totalScraped, searchMethod, confidence, language, metadata
      } = searchData;

      const client = await searchPool.connect();
      try {

        const sql = `INSERT INTO search_queries (
          search_id, original_query, normalize_query, vector_query_listing, vector_query,
          category, filters, total_listing_results, total_results, search_method, confidence, language, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`;

        const params = [
          searchId, 
          originalQuery, 
          normalizeQuery, 
          listingVectorJsonArray, 
          scrapedVectorJsonArray, 
          category,
          filters, 
          totalListing || 0, 
          totalScraped || 0, 
          searchMethod || 'vector_simple',
          confidence || 1.0,
          language || 'en',
          metadata
        ];

        const insertResult = await client.query(sql, params);

        console.log(`✅ Stored new search query with ID: ${searchId}`);
        return insertResult.rowCount === 1; 

      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error storing search query:', error);
      throw error;
    }
  }

  // Get search query by ID
  async getSearchQuery(searchId) {
    try {
      const client = await searchPool.connect();
      try {
        const result = await client.query(
          'SELECT id, vector_query_listing, vector_query, category, filters, total_listing_results, total_results, search_method, metadata FROM search_queries WHERE search_id = $1',
          [searchId]
        );

        if (result.rows.length === 0) {
          return null;
        }

        console.log(`✅ Retrieved search query: ${searchId}`);
        return result.rows[0];

      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error getting search query:', error);
      throw error;
    }
  }
  // Get search results by search ID with pagination
  async getSearchResults(searchId, page = 1, limit = 50, orderBy = {}) {
    try {
      // Step 1: Get the search query
      const searchQuery = await this.getSearchQuery(searchId);
      if (!searchQuery) {
        throw new Error(`Search query not found: ${searchId}`);
      }

      const DatabaseSearchService = require('./databaseSearchService');
      const category = searchQuery.category;
      const filters = searchQuery.filters || {};
      const totalListing = searchQuery.total_listing_results || 0;
      const totalScraped = searchQuery.total_results || 0;
      const fallback = searchQuery.metadata?.fallbackUsed;

      // Step 3: Build WHERE conditions and parameters
      const offset = (page - 1) * limit;

      let dbSearchType = "both";

      if (!orderBy.price) {
        if (offset + limit <= totalListing) {
          dbSearchType = "onlyListing";
        } else if (offset >= totalListing) {
          dbSearchType = "onlyScraped";
        }
      }
      let listingSql, listingParams, scrapedSql, scrapedParams;

      if (dbSearchType === "both" || dbSearchType === "onlyListing") {
        const res = DatabaseSearchService._getListingSearchQuery(category, filters, limit, offset, orderBy);
        listingSql = res.searchSql;
        listingParams = res.params;
        listingParams.push(searchQuery.vector_query_listing);
      }
      if (dbSearchType === "both" || dbSearchType === "onlyScraped") {
        if (fallback) {
          const vectorString = JSON.parse(searchQuery.vector_query);
          const res = DatabaseSearchService._buildFallbackSearchQuery(category, vectorString, limit, offset, filters, orderBy);
          scrapedSql = res.fallbackSql;
          scrapedParams = res.fallbackParms;
        } else {
          const res = DatabaseSearchService._buildSearchQuery(category, filters, limit, offset, orderBy);
          scrapedSql = res.scrapedSearchSql;
          scrapedParams = res.scrapedSearchParams;
          scrapedParams.push(searchQuery.vector_query);
        }

      }


      const client = await searchPool.connect();
      let productResults = [];
      try {
        if (!orderBy.price && dbSearchType === "onlyListing") {
          const result = await client.query(listingSql, listingParams);
          productResults = result.rows.map(row => ({id: row.id, type: 1}));
        }
        else if (!orderBy.price && dbSearchType === "onlyScraped") {
          const result = await client.query(scrapedSql, scrapedParams);
          productResults = result.rows.map(row => ({id: row.hid, type: 2}));
        }
        else {
          const listing = client.query(listingSql, listingParams);
          const scraped = client.query(scrapedSql, scrapedParams);
          let [listingResults, scrapedResults] = await Promise.all([listing, scraped]);

          if (orderBy.price) {
            productResults = this.mergeResults(listingResults.rows, scrapedResults.rows, limit, orderBy);
          }
          else {
            listingResults = listingResults.rows.map(row => ({id: row.id, type: 1}));
            scrapedResults = scrapedResults.rows.map(row => ({id: row.hid, type: 2}));
            productResults = [...listingResults, ...scrapedResults];
          }
        }

        const totalCount = totalListing + totalScraped;

        return {
          searchId,
          productResults,
          totalCount,
          hasMore: (page * limit) < totalCount,
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error getting search results:', error);
      throw error;
    }
  }

  mergeResults(listingResults, scrappedResults, limit, orderBy) {
    const results = [];
    let listingCount = 0, scrapedCount = 0, iterator = 0;
    const isAscending = orderBy.price.toUpperCase() === 'ASC';

    while (iterator < limit && listingResults.length > listingCount && scrappedResults.length > scrapedCount) {
      iterator ++;
      const listingPrice = parseInt(listingResults[listingCount].price) || 0;
      const scrapedPrice = parseInt(scrappedResults[scrapedCount].price) || 0;

      if ( listingResults[listingCount].boost || (isAscending && listingPrice <= scrapedPrice)  ||  (!isAscending && listingPrice >= scrapedPrice) ) {
        results.push({id: listingResults[listingCount].id, type: 1 });
        listingCount++;
      }
      else {
        results.push({id: scrappedResults[scrapedCount].hid, type: 2 });
        scrapedCount++;
      }
    }
    while (iterator < limit && listingResults.length > listingCount){
      iterator ++;
      results.push({id: listingResults[listingCount].id, type: 1 });
      listingCount++;
    }

    while (iterator < limit && scrappedResults.length > scrapedCount){
      iterator ++;
      results.push({id: scrappedResults[scrapedCount].hid, type: 2 });
      scrapedCount++;
    }

    return results;
  }

  // Get recent searches
  async getRecentSearches(limit = 10) {
    try {
      const client = await searchPool.connect();
      try {
        const result = await client.query(`
          SELECT * FROM search_queries
          ORDER BY created_at DESC
          LIMIT $1
        `, [limit]);

        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error getting recent searches:', error);
      throw error;
    }
  }

  // Get popular searches (by frequency)
  async getPopularSearches(limit = 10) {
    try {
      const client = await searchPool.connect();
      try {
        const sql = `
          SELECT search_id, original_query, category, COUNT(*) as frequency
          FROM search_queries
          GROUP BY search_id, original_query, category
          ORDER BY frequency DESC
          LIMIT $1
        `;
        
        const result = await client.query(sql, [limit]);
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error getting popular searches:', error);
      throw error;
    }
  }

  // Update search results count
  async updateSearchResults(searchId, totalListing = 0, totalScraped = 0) {
    try {
      const client = await searchPool.connect();
      try {
        const sql = 'UPDATE search_queries SET total_listing_results = $1, total_results = $2, updated_at = NOW() WHERE search_id = $3';
        const params = [totalListing, totalScraped, searchId];

        const result = await client.query(sql, params);

        if (result.rowCount > 0) {
          console.log(`✅ Updated search results for ID: ${searchId}`);
          return true;
        } else {
          console.warn(`⚠️  No search found to update: ${searchId}`);
          return false;
        }

      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error updating search results:', error);
      throw error;
    }
  }

  // Helper method to parse price value
  parsePriceValue(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    
    // Remove common words and extract numeric value
    const cleanValue = value.toLowerCase()
      .replace(/under\s+/i, '')
      .replace(/over\s+/i, '')
      .replace(/less\s+than\s+/i, '')
      .replace(/more\s+than\s+/i, '')
      .replace(/up\s+to\s+/i, '')
      .replace(/maximum\s+/i, '')
      .replace(/minimum\s+/i, '')
      .replace(/around\s+/i, '')
      .replace(/approximately\s+/i, '')
      .replace(/about\s+/i, '')
      .replace(/between\s+/i, '')
      .replace(/and\s+/i, '')
      .replace(/to\s+/i, '')
      .replace(/,\s*/g, '') // Remove commas
      .replace(/\s+/g, ''); // Remove spaces
    
    // Extract numeric value
    const numericMatch = cleanValue.match(/[\d,]+\.?\d*/);
    if (numericMatch) {
      const numericValue = parseFloat(numericMatch[0].replace(/,/g, ''));
      return isNaN(numericValue) ? null : numericValue;
    }
    
    return null;
  }
}

module.exports = new SearchQueryService(); 