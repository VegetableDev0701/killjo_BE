// Servicio para generar embeddings (vectores) usando OpenAI API
const EmbeddingService = require('../openAi/embaddingService');
const searchQueryService = require('./searchQueryService');
const { defaultCategories, categoryKeys, productIdentifiers, subCategoriesField } = require('../../data/categoryData.js');
const { Pool } = require('pg');
// Servicio para generar texto estructurado para listings (NO genera embeddings, solo texto)
const listingTextService = require("../embeddingService");
const ConversationHistoryService = require('../conversationHistoryService');
const AnalyticsService = require('../../analytics/analyticsService');

class DatabaseSearchService {
  constructor() {
    this.ragPool = new Pool({
      connectionString: process.env.LISTING_URL,
      ssl: false,
    });
  }

  async search(rawQuery, intentResult, page, limit, conversationId, language, location = {}) {
    try {
      const category = intentResult.category || 'vehicles';
      const searchResult = await this.simpleFastSearch(
        intentResult,
        page,
        limit
      );

      await AnalyticsService.logSearchQuery(rawQuery, searchResult, location);

      const t = Date.now();
      const searchId = searchQueryService.generateSearchId(searchResult.normalized_query, category);

      // Check if this search already exists in database
      const existingSearch = await searchQueryService.getSearchQuery(searchId);
      if (existingSearch) {
        console.log(`✅ Found existing search with ID: ${searchId}`);
        await searchQueryService.updateSearchResults(
          searchId,
          searchResult.totalListing,
          searchResult.totalScraped
        );
      } else {
        console.log(`🆕 Creating new search with ID: ${searchId}`);
        // Store the search query in database for future pagination
        try {
          await searchQueryService.storeSearchQuery({
            searchId: searchId,
            originalQuery: rawQuery,
            normalizeQuery: intentResult.normalized_query,
            listingVectorJsonArray: JSON.stringify(searchResult.listing_embedding_array),
            scrapedVectorJsonArray: JSON.stringify(searchResult.scraped_embedding_array),
            category: category,
            filters: intentResult.filters || {},
            totalListing: searchResult.totalListing || 0,
            totalScraped: searchResult.totalScraped || 0, // Will be updated after search
            searchMethod: 'vector_simple',
            confidence: intentResult.confidence || 1.0,
            language: 'en',
            metadata: {
              page: searchResult.page || 1,
              limit: searchResult.limit || 10,
              hasFilters: searchResult.hasFilters || false,
              fallbackUsed: searchResult.fallbackUsed || false,
            },
          });
        } catch (error) {
          console.error('Failed to store search query:', error);
        }
      }

      console.log(`searchQueryService time: `, Date.now() - t);

      const total = searchResult.totalListing + searchResult.totalScraped;

      if (total == 0) {

        await ConversationHistoryService.addMessageToHistory(conversationId, 'assistant', "Do You want to see most matched product not exact one?");

        let message_en = "I couldn't find that right now, but you can be the first to list it. Or would you like me to show similar listings? 🔥";
        let message_es = "No pude encontrar eso ahora mismo, pero puedes ser el primero en publicarlo. ¿O quieres que te muestre listados similares? 🔥";

        return {
          type: 'ai_chat',
          message: language === 'es' ? message_es : message_en,
          confidence: 1.0,
        }
      }


      return {
        type: 'database_search',
        searchId: searchId,
        productResults: searchResult.productResults,
        totalCount: total || 0,
        page: searchResult.page || page,
        limit: searchResult.limit || limit,
        hasMore: total > page * limit,
        category: category,
        confidence: searchResult.confidence || intentResult.confidence || 1.0,
        intent: intentResult.intent,
        detectedFilters: intentResult.filters,
        reason: intentResult.reason,
      };
    } catch (error) {
      console.error('Database search error:', error);
      throw new Error('Search failed');
    }
  }

  getVectorEmbeddingQueries(intentResult) {
    let scrapedEmbeddingQuery = intentResult.normalized_query;
    if (intentResult.keywords && intentResult.keywords.length) {
      scrapedEmbeddingQuery = intentResult.keywords.join(' ');
    }

    const data = {
      category: intentResult.category,
      basic_attributes: {},
      attributes: intentResult.filters,
    }
    // Generar texto estructurado para listing (este servicio genera texto, no embeddings)
    const listingEmbeddingQuery = scrapedEmbeddingQuery + ' ' + listingTextService.getEmbeddingTextForListing(data);

    return { listingEmbeddingQuery, scrapedEmbeddingQuery };

  }

  async simpleFastSearch(intentResult, page = 1, limit = 3, orderBy = {}) {
    try {
      const { normalized_query, category, keywords, filters, fallback } = intentResult;


      this._validateSearchInputs(normalized_query, category, page, limit);


      const offset = (page - 1) * limit;


      if (fallback) {
        // Get vector embedding queries and generate embeddings for fallback
        const { listingEmbeddingQuery, scrapedEmbeddingQuery } = this.getVectorEmbeddingQueries(intentResult);

        const listingEmbedding = EmbeddingService.embedText(listingEmbeddingQuery);
        const scrapedEmbedding = EmbeddingService.embedText(scrapedEmbeddingQuery);

        const [listingVectorArray, scrapedVectorArray] = await Promise.all([listingEmbedding, scrapedEmbedding]);

        const fallbackRes = await this.applyOriginalFallbackSearch(
          category,
          listingVectorArray,
          scrapedVectorArray,
          limit,
          offset,
          filters
        );

        return {
          ...fallbackRes,
          listing_embedding_array: listingVectorArray,
          scraped_embedding_array: scrapedVectorArray,
          normalized_query: normalized_query,
        };
      }

      const { searchSql, params, countSql, countParams } =
        this._getListingSearchQuery(category, filters, limit, offset, orderBy);

      const { scrapedSearchSql, scrapedSearchParams, scrapedCountSql, scrapedCountParams } =
        this._buildSearchQuery(category, filters, limit, offset, orderBy);


      let t = Date.now();
      const embeddingStart = Date.now();
      const { listingEmbeddingQuery, scrapedEmbeddingQuery } = this.getVectorEmbeddingQueries(intentResult);

      //vector embedding
      const listingEmbedding = EmbeddingService.embedText(listingEmbeddingQuery);
      const scrapedEmbedding = EmbeddingService.embedText(scrapedEmbeddingQuery);
      // count the total results
      const countListing = this.ragPool.query(countSql, countParams);
      const countScraped = this.ragPool.query(scrapedCountSql, scrapedCountParams);
      //promise to make them faster
      const [resultListing, resultScraped, listingVectorArray, scrapedVectorArray] =
        await Promise.all([countListing, countScraped, listingEmbedding, scrapedEmbedding]);

      const embeddingTime = Date.now() - embeddingStart;

      // Los embeddings son number[] puros, sin metadata
      // El cache hit se trackea en métricas (no dentro del vector)
      const listingVector = listingVectorArray;
      const scrapedVector = scrapedVectorArray;

      let totalListing = resultListing.rows[0].total_count;
      let totalScraped = resultScraped.rows[0].total_count;
      if (typeof totalListing === 'string') totalListing = parseInt(totalListing, 10);
      if (typeof totalScraped === 'string') totalScraped = parseInt(totalScraped, 10);
      let total = totalListing + totalScraped;

      params.push(JSON.stringify(listingVector));
      scrapedSearchParams.push(JSON.stringify(scrapedVector));

      console.log(`⏱️ count and embedding time: ${Date.now() - t}ms`);
      t = Date.now();



      if (total === 0) {
        const fallbackRes = await this.applyFallbackSearch(
          category,
          listingVectorArray,
          scrapedVectorArray,
          limit,
          offset,
          filters
        );
        return {
          ...fallbackRes,
          listing_embedding_array: listingVectorArray,
          scraped_embedding_array: scrapedVectorArray,
          normalized_query: normalized_query,
        };
      }
      let productResults = [];
      if (offset + limit <= totalListing) {
        const listingResults = await this.ragPool.query(searchSql, params);
        console.log(`⏱️ Search listingResults:`, listingResults.rows.map(result => ({ title: result.title, id: result.id, similarity: result.similarity })));
        productResults = listingResults.rows.map(result => ({ id: result.id, type: 1 }));
      } else if (totalListing <= offset) {
        const scrapedResults = await this.ragPool.query(scrapedSearchSql, scrapedSearchParams);
        productResults = scrapedResults.rows.map(result => ({ id: result.hid, type: 2 }));
      } else {
        const listing = this.ragPool.query(searchSql, params);
        const scraped = this.ragPool.query(scrapedSearchSql, scrapedSearchParams);
        let [listingResults, scrapedResults] = await Promise.all([listing, scraped]);
        console.log(`⏱️ Search listingResults:`, listingResults.rows.map(result => ({ title: result.title, id: result.id, similarity: result.similarity })));
        listingResults = listingResults.rows.map(result => ({ id: result.id, type: 1 }));
        scrapedResults = scrapedResults.rows.map(result => ({ id: result.hid, type: 2 }));
        productResults = [...listingResults, ...scrapedResults];
        productResults.splice(limit);
      }


      console.log(`⏱️ SQL query time: ${Date.now() - t}ms`);




      return {
        productResults,
        totalListing: totalListing,
        totalScraped: totalScraped,
        page: Math.floor(offset / limit) + 1,
        limit,
        category,
        filters: filters,
        listing_embedding_array: listingVectorArray,
        scraped_embedding_array: scrapedVectorArray,
        normalized_query: normalized_query,
        hasFilters: false,
        fallbackUsed: false,
        // Métricas para instrumentación
        metrics: {
          embeddings: embeddingTime
        }
      };
    } catch (error) {
      console.error('Simple fast search error:', error);
      throw new Error('Search failed');
    }
  }

  buildQueryForPagination(searchId, page, limit) {
    if (!searchId || !page || !limit) {
      throw new Error('Invalid parameters for pagination');
    }

    const offset = (page - 1) * limit;

    return {
      sql: 'SELECT * FROM search_queries WHERE search_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      params: [searchId, limit, offset],
    };
  }

  _validateSearchInputs(vectorQuery, category, page, limit) {

    if (!vectorQuery || typeof vectorQuery !== 'string') {
      throw new Error('Vector query must be a non-empty string');
    }

    const categoryList = [...categoryKeys, 'others'];
    if (!categoryList.includes(category)) {
      throw new Error(
        `Unsupported category: ${category}. Supported: ${categoryKeys.join(
          ', '
        )}`
      );
    }

    if (!Number.isInteger(page) || page < 1) {
      throw new Error('Page must be a positive integer');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Limit must be a positive integer between 1 and 100');
    }
  }

  _getCategoryConfig(category) {
    const configs = {
      vehicles: {
        table: 'vehicles_color_v1',
        embedding_column: 'embedding_v2',
        price_column: 'price_value',
        price_currency_column: 'price_currency',
        columns:
          'hid',
      },
      products: {
        table: 'products_clean',
        embedding_column: 'embedding_v2',
        price_column: 'price_value',
        price_currency_column: 'price_currency',
        columns:
          'hid',
      },
      real_estate: {
        table: 'real_estate_v2',
        embedding_column: 'embedding_v2',
        price_column: 'price_usd',
        columns:
          'hid, location, search_query',
      },
    };

    if (category !== 'vehicles' && category !== 'real_estate') {
      category = 'products';
    }

    return configs[category];
  }

  getMaxMin(value) {
    if (value.includes('-')) {
      const parts = value.split('-').map((v) => v.trim());
      const min = parts[0] ? parseInt(parts[0]) : null;
      const max = parts[1] ? parseInt(parts[1]) : null;
      return { min, max };
    }
    const num = parseInt(value);
    return { min: num, max: num };

  }

  matchTitleDescription(category, filters) {
    const attributes = productIdentifiers[category]
    if (!attributes) return true;

    const exist = attributes.some(item => filters[item] && filters[item].toLowerCase() !== 'other' && filters[item].toLowerCase() !== 'otro' && filters[item].toLowerCase() !== 'otros');
    if (exist) {
      return false;
    } else {
      return true;
    }
  }

  convertDataToSpanish(categoryData, attributeName, data) {
    const item = categoryData.attributes[attributeName];
    const res = item.options.find(opt => opt.en.toLowerCase() === data.toLowerCase());
    return res ? res.es : data;
  }

  /**
   * Build WHERE conditions for different categories
   */

  _getListingSearchQuery(category, filters, limit, offset, sortOrderBy = {}) {
    if (category === 'others') {
      console.log("Category not found in Listings");
      return {};
    }
    const basicAttributesType = {
      listing_type: 'enum'
    }
    let categoryData;
    let attributesType;
    for (const item of defaultCategories) {
      if (item.category_key === category) {
        categoryData = item;
        attributesType = Object.fromEntries(
          Object.entries(item.attributes).map(([key, val]) => [key, val.type])
        );
        break;
      }
    }

    const params = [];
    const conditions = [];

    const orderBy = ['boost DESC'];
    if (sortOrderBy.price) orderBy.push(`price ${sortOrderBy.price.toUpperCase()}`);
    orderBy.push('similarity DESC');

    // Category condition
    conditions.push(`category ILIKE $${params.length + 1}`);
    params.push(category);

    //Check status
    conditions.push(`status ILIKE $${params.length + 1}`);
    params.push('active');

    if (this.matchTitleDescription(category, filters)) {
      const generalNames = filters['general_names'] || [];

      if (generalNames.length > 0) {
        // Create conditions for each name to match against title or description
        const titleDescConditions = [];
        for (let i = 0; i < generalNames.length; i++) {
          titleDescConditions.push(`(title ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`);
          params.push(`%${generalNames[i]}%`);
        }

        // Add the combined condition with OR between each name match
        if (titleDescConditions.length) {
          conditions.push(`(${titleDescConditions.join(' OR ')})`);
        }

      }
    }


    try {
      for (const attributeName in filters) {
        if (filters.hasOwnProperty(attributeName) && filters[attributeName] !== null) {

          if (attributesType[attributeName]) {
            this._buildAttributesSQL(categoryData, attributeName, filters[attributeName], attributesType[attributeName], conditions, params);
          }

          else if (attributeName === 'budget') {
            const { min, max } = this.getMaxMin(filters[attributeName]);
            if (min !== null) {
              conditions.push(`price >= $${params.length + 1}`);
              params.push(min);
            }
            if (max !== null) {
              conditions.push(`price <= $${params.length + 1}`);
              params.push(max);
            }
          }

          else if (attributeName === 'city') {
            conditions.push(`(location->>'${attributeName}') ILIKE $${params.length + 1}`);
            params.push(filters[attributeName]);
          }

          else if (basicAttributesType[attributeName]) {
            if (basicAttributesType[attributeName] === 'string' || basicAttributesType[attributeName] === 'enum') {
              conditions.push(`(basic_attributes->>'${attributeName}') ILIKE $${params.length + 1}`);
              params.push(filters[attributeName]);
            }
          }
          else if (attributeName === 'modelArray') {
            const modelCondition = [];
            for (let val of filters[attributeName]) {
              modelCondition.push(`(attributes->>'model') ILIKE $${params.length + 1}`);
              params.push(`%${val}%`);
            }
            // Add the combined condition with OR between each name match
            if (modelCondition.length) {
              conditions.push(`(${modelCondition.join(' OR ')})`);
            }
          }
        }

      }
    } catch (err) {
      console.log(err);
    }

    if (!sortOrderBy.price && filters.sort_by && filters.sort_order) {
      orderBy.push(`price ${filters.sort_order.toUpperCase()}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const oderByClause = orderBy.length > 0 ? `ORDER BY ${orderBy.join(', ')}` : '';

    const countSql = `
      SELECT COUNT(*) as total_count
      FROM listings 
      ${whereClause}
    `;
    const countParams = [...params];

    params.push(limit);
    params.push(offset);

    const searchSql = `
      SELECT id, price, title, boost, 1 - (vector <=> $${params.length + 1}::vector) as similarity
      FROM listings
      ${whereClause}
      ${oderByClause}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    return { searchSql, params, countSql, countParams };
  }

  skipSearchForAttribute(key) {
    const skipAttributes = ['model', 'engine_size', 'package_size', 'color',
      'ingredients', 'nutrition_facts', 'storage_instructions', 'service_area', 'compatible_with',
      'start_date', 'contract_duration', 'dimensions', 'power_consumption', 'language', 'edition',
      'weight', 'breed', 'special_needs', 'provenance', 'size', 'usage_instructions', 'duration',
      'schedule', 'location', 'instructor_qualifications', 'prerequisites', 'event_date',
      'event_time', 'venue', 'city', 'seating_section', 'age_restriction', 'dress_code',
      'voltage', 'battery_type', 'maintenance_history'];
    return skipAttributes.includes(key);
  }

  _buildAttributesSQL(categoryData, key, data, dataType, conditions, params) {
    const isRequired = categoryData.attributes[key].required;

    if (dataType === 'string' && !this.skipSearchForAttribute(key)) {
      if (isRequired) {
        conditions.push(`(attributes->>'${key}') ILIKE $${params.length + 1}`);
      } else {
        conditions.push(`((attributes->>'${key}') ILIKE $${params.length + 1} OR (attributes->>'${key}') IS NULL)`);
      }
      params.push(`%${data}%`);
    }

    else if (dataType === 'enum' && data.toLowerCase() !== 'otro' && data.toLowerCase() !== 'otros' && data.toLowerCase() !== 'other') {
      const spanishData = this.convertDataToSpanish(categoryData, key, data);
      if (isRequired) {
        conditions.push(`((attributes->>'${key}') ILIKE $${params.length + 1} OR (attributes->>'${key}') ILIKE $${params.length + 2})`);
      } else {
        conditions.push(`((attributes->>'${key}') ILIKE $${params.length + 1} OR (attributes->>'${key}') ILIKE $${params.length + 2} OR (attributes->>'${key}') IS NULL)`);
      }

      params.push(data);
      params.push(spanishData);
    }

    else if (dataType === 'number') {
      const { min, max } = this.getMaxMin(data);
      if (min !== null) {
        conditions.push(`((attributes->>'${key}')::int >= $${params.length + 1} OR (attributes->>'${key}') IS NULL)`);
        params.push(min);
      }
      if (max !== null) {
        conditions.push(`((attributes->>'${key}')::int <= $${params.length + 1} OR (attributes->>'${key}') IS NULL)`);
        params.push(min);
      }
    }

    else if (dataType === 'boolean') {
      if (isRequired) {
        conditions.push(`(attributes->>'${key}')::boolean = $${params.length + 1}`);
      } else {
        conditions.push(`((attributes->>'${key}')::boolean = $${params.length + 1} OR (attributes->>'${key}') IS NULL)`);
      }
      params.push(data);
    }

  }

  _buildWhereConditions(category, filters, orderBy) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    let originalCategory = category;
    if (category != 'vehicles' && category != 'real_estate') {
      category = 'products';
    }

    const config = this._getCategoryConfig(category);

    const orderByParams = ['similarity DESC'];
    if (orderBy.price) {
      orderByParams.unshift(`${config.price_column} ${orderBy.price.toUpperCase()}`);
    }

    switch (category) {
      case 'vehicles':
        if (filters.brand) {
          conditions.push(`brand ILIKE $${paramIndex++}`);
          params.push(`%${filters.brand}%`);
        }
        if (filters.city) {
          conditions.push(`city ILIKE $${paramIndex++}`);
          params.push(`%${filters.city}%`);
        }
        if (filters.year) {
          const { min, max } = this.getMaxMin(filters.year);
          if (min !== null) {
            conditions.push(`year >= $${paramIndex++}`);
            params.push(min);
          }
          if (max !== null) {
            conditions.push(`year <= $${paramIndex++}`);
            params.push(max);
          }
        }
        if (filters.color) {
          conditions.push(`(exterior_color ILIKE $${paramIndex})`);
          params.push(`%${filters.color}%`);
          paramIndex++;
        }
        if (filters.fuel_type) {
          conditions.push(`fuel_type ILIKE $${paramIndex++}`);
          params.push(`%${filters.fuel_type}%`);
        }
        if (filters.transmission) {
          conditions.push(`transmission ILIKE $${paramIndex++}`);
          params.push(`%${filters.transmission}%`);
        }
        if (filters.body_type) {
          conditions.push(`car_type ILIKE $${paramIndex++}`);
          params.push(`%${filters.body_type}%`);
        }
        if (filters.seats) {
          const { min, max } = this.getMaxMin(filters.seats);
          if (min !== null) {
            conditions.push(`passengers >= $${paramIndex++}`);
            params.push(min);
          }
          if (max !== null) {
            conditions.push(`passengers <= $${paramIndex++}`);
            params.push(max);
          }
        }
        break;

      case 'products':

        if (filters.brand) {
          conditions.push(`brand ILIKE $${paramIndex++}`);
          params.push(`%${filters.brand}%`);
        }
        if (filters.city) {
          conditions.push(`location ILIKE $${paramIndex++}`);
          params.push(`%${filters.city}%`);
        }
        if (originalCategory) {
          conditions.push(`category ILIKE $${paramIndex++}`);
          params.push(`%${originalCategory}%`);
        }
        const getField = subCategoriesField[originalCategory];
        if (getField && filters[getField]) {
          conditions.push(`product_type ILIKE $${paramIndex++}`);
          params.push(`%${filters[getField]}%`);
        }

        break;

      case 'real_estate':
        if (filters.property_type) {
          conditions.push(`property_type ILIKE $${paramIndex++}`);
          params.push(`%${filters.property_type}%`);
        }

        if (filters.bedrooms) {
          const { min, max } = this.getMaxMin(filters.bedrooms);
          if (min !== null && max !== null) {
            conditions.push(`bedrooms BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            params.push(min, max);
          }
          else if (min !== null) {
            conditions.push(`bedrooms >= $${paramIndex++}`);
            params.push(min);
          }
          else if (max !== null) {
            conditions.push(`bedrooms <= $${paramIndex++}`);
            params.push(max);
          }
        }
        if (filters.bathrooms) {
          const { min, max } = this.getMaxMin(filters.bathrooms);
          if (min !== null && max !== null) {
            conditions.push(`bathrooms BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            params.push(min, max);
          } else if (min !== null) {
            conditions.push(`bathrooms >= $${paramIndex++}`);
            params.push(min);
          } else if (max !== null) {
            conditions.push(`bathrooms <= $${paramIndex++}`);
            params.push(max);
          }
        }
        if (filters.location) {
          if (filters.city) {
            conditions.push(`(location ILIKE $${paramIndex++} OR location ILIKE $${paramIndex++})`);
            params.push(`%${filters.location}%`, `%${filters.city}%`);
          } else {
            conditions.push(`location ILIKE $${paramIndex++}`);
            params.push(`%${filters.location}%`);
          }
        }
        if (filters.area_size) {
          const { min, max } = this.getMaxMin(filters.area_size);
          if (min !== null && max !== null) {
            conditions.push(`area BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            params.push(min, max);
          } else if (min !== null) {
            conditions.push(`area >= $${paramIndex++}`);
            params.push(min);
          } else if (max !== null) {
            conditions.push(`area <= $${paramIndex++}`);
            params.push(max);
          }
        }
        break;
    }

    // Add price filters for all categories

    if (filters.min_price) {
      conditions.push(
        `CAST(${config.price_column} AS DECIMAL) >= $${paramIndex++}`
      );
      params.push(parseFloat(filters.min_price));
    }
    if (filters.max_price) {
      conditions.push(
        `CAST(${config.price_column} AS DECIMAL) <= $${paramIndex++}`
      );
      params.push(parseFloat(filters.max_price));
    }
    if (!orderBy.price && filters.sort_by && filters.sort_order) {
      if (filters.sort_by === 'price') {
        orderByParams.push(
          `${config.price_column} ${filters.sort_order.toUpperCase()}`
        );
      }
    }


    return { conditions, params, orderByParams, paramIndex };
  }

  /**
   * Build complete search query
   */
  _buildSearchQuery(category, filters, limit, offset, orderBy) {
    const config = this._getCategoryConfig(category);
    const { conditions, params, orderByParams, paramIndex } = this._buildWhereConditions(
      category,
      filters,
      orderBy
    );

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const oderByClause = orderByParams.length > 0 ? `ORDER BY ${orderByParams.join(', ')}` : '';


    // Build price column expression for DOP conversion
    // Assume USDtoDOPrate is available in scope (otherwise, pass as param or get from env/config)
    const USDtoDOPrate = 63; // Default rate

    let priceExpr;
    if (config.table === 'real_estate_v2') {
      priceExpr = `${config.price_column} * ${USDtoDOPrate}`;
    } else if (config.price_currency_column) {
      priceExpr = `
    CASE
      WHEN ${config.price_currency_column} = 'USD'
        THEN ${config.price_column} * ${USDtoDOPrate}
      ELSE ${config.price_column}
    END
  `;
    } else {
      priceExpr = `${config.price_column}`;
    }

    const scrapedSearchSql = `
      SELECT ${config.columns},
             ${priceExpr} AS price,
             1 - (${config.embedding_column} <=> $${paramIndex + 2}::vector) as similarity
      FROM ${config.table}
      ${whereClause}
      ${oderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const scrapedSearchParams = [...params, limit, offset];

    const scrapedCountSql = `
      SELECT COUNT(*) as total_count
      FROM ${config.table}
      ${whereClause}
    `;
    const scrapedCountParams = [...params];

    return { scrapedSearchSql, scrapedSearchParams, scrapedCountSql, scrapedCountParams };
  }

  _buildFallbackWhereConditions(category, filters, sortOrderBy) {
    const config = this._getCategoryConfig(category);
    const conditions = [];
    const params = [];
    const orderByParams = ['similarity DESC'];
    if (sortOrderBy.price) {
      orderByParams.unshift(`${config.price_column} ${sortOrderBy.price.toUpperCase()}`);
    }
    let paramIndex = 4;

    switch (category) {
      case 'vehicles':
        break;

      case 'products':

        break;

      case 'real_estate':
        if (filters.bedrooms) {
          const { min, max } = this.getMaxMin(filters.bedrooms);
          if (min !== null && max !== null) {
            conditions.push(`bedrooms BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            params.push(min, max);
          }
          else if (min !== null) {
            conditions.push(`bedrooms >= $${paramIndex++}`);
            params.push(min);
          }
          else if (max !== null) {
            conditions.push(`bedrooms <= $${paramIndex++}`);
            params.push(max);
          }
        }
        if (filters.bathrooms) {
          const { min, max } = this.getMaxMin(filters.bathrooms);
          if (min !== null && max !== null) {
            conditions.push(`bathrooms BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            params.push(min, max);
          } else if (min !== null) {
            conditions.push(`bathrooms >= $${paramIndex++}`);
            params.push(min);
          } else if (max !== null) {
            conditions.push(`bathrooms <= $${paramIndex++}`);
            params.push(max);
          }
        }
        break;
    }


    if (filters.min_price) {
      conditions.push(
        `CAST(${config.price_column} AS DECIMAL) >= $${paramIndex++}`
      );
      params.push(parseFloat(filters.min_price));
    }
    if (filters.max_price) {
      conditions.push(
        `CAST(${config.price_column} AS DECIMAL) <= $${paramIndex++}`
      );
      params.push(parseFloat(filters.max_price));
    }
    if (!sortOrderBy.price && filters.sort_by && filters.sort_order) {
      if (filters.sort_by === 'price') {
        orderByParams.push(
          `${config.price_column} ${filters.sort_order.toUpperCase()}`
        );
      }
    }
    return { conditions, params, orderByParams };
  }

  _buildFallbackSearchQuery(category, scrappingVectorString, limit, offset, filters, orderBy = {}) {
    const config = this._getCategoryConfig(category);

    const { conditions, params, orderByParams } = this._buildFallbackWhereConditions(
      category,
      filters,
      orderBy
    );

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const oderByClause = orderByParams.length > 0 ? `ORDER BY ${orderByParams.join(', ')}` : '';


    const fallbackSql = `
      SELECT ${config.columns},
      1 - (${config.embedding_column} <=> $1::vector) as similarity
      FROM ${config.table}
      ${whereClause}
      ${oderByClause}
      LIMIT $2 OFFSET $3
    `;
    const vectorStringString = JSON.stringify(scrappingVectorString);
    const fallbackParms = [vectorStringString, limit, offset, ...params];

    const countSql = `
      SELECT COUNT(*) as total_count
      FROM ${config.table}
      ${whereClause}
    `;
    const countParams = [...params];

    console.log('🔍 Fallback SQL Query:', fallbackSql);
    console.log('🔍 Fallback Params:', fallbackParms);

    return { fallbackSql, fallbackParms, countSql, countParams };
  }

  async applyFallbackSearch(category, listingVectorString, scrappingVectorString, limit, offset, filters) {
    try {
      return {
        productResults: [],
        totalListing: 0,
        totalScraped: 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        category,
        filters: filters,
        hasFilters: false,
        fallbackUsed: true,
        listing_embedding_array: listingVectorString,
        scraped_embedding_array: scrappingVectorString,
      };
    } catch (error) {
      console.error('Error during fallback search:', error);
      throw new Error('Fallback search failed');
    }
  }

  async applyOriginalFallbackSearch(category, listingVectorString, scrappingVectorString, limit, offset, filters) {

    try {

      const { searchSql: listingSearchSql, params: listingParams, countSql: listingCountSql, countParams: listingCountParams } =
        this._getListingSearchQuery(category, filters, limit, offset, {});

      const { fallbackSql: scrapedSearchSql, fallbackParms: scrapedParams, countSql: scrapedCountSql, countParams: scrapedCountParams } =
        this._buildFallbackSearchQuery(category, scrappingVectorString, limit, offset, filters);

      if (listingSearchSql && listingParams) {
        listingParams.push(JSON.stringify(listingVectorString));
      }

      const client = await this.ragPool.connect();

      const promises = [];
      if (listingCountSql && listingCountParams) {
        promises.push(client.query(listingCountSql, listingCountParams));
      } else {
        promises.push(Promise.resolve({ rows: [{ total_count: 0 }] }));
      }
      promises.push(client.query(scrapedCountSql, scrapedCountParams));

      const [listingCountResult, scrapedCountResult] = await Promise.all(promises);

      let totalListing = listingCountResult.rows[0].total_count;
      let totalScraped = scrapedCountResult.rows[0].total_count;
      if (typeof totalListing === 'string') totalListing = parseInt(totalListing, 10);
      if (typeof totalScraped === 'string') totalScraped = parseInt(totalScraped, 10);

      let productResults = [];

      if (offset + limit <= totalListing && listingSearchSql && listingParams) {
        const listingResults = await client.query(listingSearchSql, listingParams);
        productResults = listingResults.rows.map(result => ({ id: result.id, type: 1 }));
      } else if (totalListing <= offset) {
        const scrapedResults = await client.query(scrapedSearchSql, scrapedParams);
        productResults = scrapedResults.rows.map(result => ({ id: result.hid, type: 2 }));
      } else {

        const promises = [];
        if (listingSearchSql && listingParams) {
          promises.push(client.query(listingSearchSql, listingParams));
        } else {
          promises.push(Promise.resolve({ rows: [] }));
        }
        promises.push(client.query(scrapedSearchSql, scrapedParams));

        const [listingResults, scrapedResults] = await Promise.all(promises);

        const listingMapped = listingResults.rows.map(result => ({ id: result.id, type: 1 }));
        const scrapedMapped = scrapedResults.rows.map(result => ({ id: result.hid, type: 2 }));

        productResults = [...listingMapped, ...scrapedMapped];
        productResults.splice(offset + limit);
      }

      client.release();

      return {
        productResults,
        totalListing: totalListing,
        totalScraped: totalScraped,
        page: Math.floor(offset / limit) + 1,
        limit,
        category,
        filters: filters,
        hasFilters: false,
        fallbackUsed: true,
        listing_embedding_array: listingVectorString,
        scraped_embedding_array: scrappingVectorString,
      };
    } catch (error) {
      console.error('Error during original fallback search:', error);
      throw new Error('Original fallback search failed');
    }


  }

}


module.exports = new DatabaseSearchService();
