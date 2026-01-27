const ragSearch = require('../services/search/ragService');
const redisService = require('../services/redisService');
const { pool } = require('../db');
const { OpenAI } = require('openai');
const axios = require('axios');
const { getUserLocation } = require('../services/helperFunctions');
const { Message, Conversation } = require('../db');
const { validate: validateUUIDv4 } = require('uuid');
const crypto = require('crypto');

// Add performance monitoring
const performanceMetrics = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  avgResponseTime: 0,
  categoryStats: {},
  lastRequests: []
};

function logPerformanceMetrics(startTime, category, cached, resultCount) {
  const duration = Date.now() - startTime;
  performanceMetrics.totalRequests++;
  if (cached) {
    performanceMetrics.cacheHits++;
  } else {
    performanceMetrics.cacheMisses++;
  }

  // Update average response time
  performanceMetrics.avgResponseTime =
    ((performanceMetrics.avgResponseTime * (performanceMetrics.totalRequests - 1)) + duration) /
    performanceMetrics.totalRequests;

  // Update category stats
  if (!performanceMetrics.categoryStats[category]) {
    performanceMetrics.categoryStats[category] = {
      count: 0,
      avgResponseTime: 0,
      totalResults: 0
    };
  }
  const catStats = performanceMetrics.categoryStats[category];
  catStats.count++;
  catStats.avgResponseTime =
    ((catStats.avgResponseTime * (catStats.count - 1)) + duration) /
    catStats.count;
  catStats.totalResults += resultCount;

  // Keep track of last 10 requests
  performanceMetrics.lastRequests.unshift({
    timestamp: new Date().toISOString(),
    category,
    duration,
    cached,
    resultCount
  });
  performanceMetrics.lastRequests = performanceMetrics.lastRequests.slice(0, 10);

  // Log detailed metrics
  console.log('\n📊 Search Performance Metrics:');
  console.log('--------------------------------');
  console.log(`Total Requests: ${performanceMetrics.totalRequests}`);
  console.log(`Cache Hit Rate: ${((performanceMetrics.cacheHits / performanceMetrics.totalRequests) * 100).toFixed(2)}%`);
  console.log(`Average Response Time: ${performanceMetrics.avgResponseTime.toFixed(2)}ms`);
  console.log('\nCategory Statistics:');
  Object.entries(performanceMetrics.categoryStats).forEach(([cat, stats]) => {
    console.log(`\n${cat.toUpperCase()}:`);
    console.log(`  Requests: ${stats.count}`);
    console.log(`  Avg Response Time: ${stats.avgResponseTime.toFixed(2)}ms`);
    console.log(`  Total Results: ${stats.totalResults}`);
    console.log(`  Avg Results/Request: ${(stats.totalResults / stats.count).toFixed(2)}`);
  });
  console.log('\nLast 10 Requests:');
  performanceMetrics.lastRequests.forEach(req => {
    console.log(`[${req.timestamp}] ${req.category}: ${req.duration}ms, ${req.resultCount} results${req.cached ? ' (cached)' : ''}`);
  });
  console.log('--------------------------------\n');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class SearchController {

  async unifiedSearch(req, res) {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    // Métricas estructuradas para análisis
    const metrics = {
      requestId,
      startTime,
      query: req.body.message,
      steps: {},
      cache: {
        embedding: { hit: false, miss: false, error: false },
        result: { hit: false, miss: false, error: false }
      },
      errors: []
    };

    let lastStepTime = startTime;
    const logTiming = (step) => {
      const now = Date.now();
      const stepDuration = now - lastStepTime;
      const totalElapsed = now - startTime;
      console.log(`⏱️ ${step}: ${stepDuration}ms (total: ${totalElapsed}ms)`);
      metrics.steps[step] = stepDuration; // Guardar duración del step, no tiempo acumulado
      lastStepTime = now;
    };

    try {

      const { message, chatId: conversationId, page = 1, limit = 20, websearch = false, skipMessageStorage = false, location = {} } = req.body;


      const isAuthenticated = req.user && req.user.id;
      const userId = isAuthenticated ? req.user.id : null;
      const userName = isAuthenticated ? req.user.fullName : null;


      if (isAuthenticated) {
        console.log(`🔐 Authenticated user: ${req.user.email} (ID: ${userId})`);
      } else {
        console.log(`👤 Non-authenticated user - search will proceed without message storage`);
      }


      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      logTiming('input_validation');

      // 3. Use RAG-based search with intent routing
      let searchResult;
      const ragSearchStart = Date.now();
      try {
        let userLocation = null;
        if (location?.latitude !== undefined && location?.longitude !== undefined) {
          userLocation = await getUserLocation(req);
        } else if (isAuthenticated && req.user.location) {
          userLocation = req.user.location;
        } else {
          userLocation = await getUserLocation(req);
        }

        searchResult = await ragSearch.search(message, page, limit, conversationId, { userName: userName, location: userLocation });
        metrics.steps.ragSearch = Date.now() - ragSearchStart;

        // Trackear cache hits si están disponibles
        if (searchResult._cached) {
          metrics.cache.result.hit = true;
        } else {
          metrics.cache.result.miss = true;
        }

        // Desglosar métricas internas si están disponibles
        if (searchResult.metrics) {
          metrics.steps.intentDetection = searchResult.metrics.intentDetection;
          metrics.steps.embeddings = searchResult.metrics.embeddings;
          metrics.steps.vectorSearch = searchResult.metrics.vectorSearch;

          // Trackear cache de embeddings
          if (searchResult.metrics.embeddingCache) {
            metrics.cache.embedding = searchResult.metrics.embeddingCache;
          }
        }

        console.log(`⏱️ rag_search: ${metrics.steps.ragSearch}ms`);
      } catch (error) {
        console.error('RAG search error:', error);
        metrics.steps.ragSearch = Date.now() - ragSearchStart;
        metrics.errors.push({ step: 'rag_search', error: error.message });
        // Fallback to existing search if RAG fails
        searchResult = {
          type: 'search',
          results: [],
          response: "I encountered an error processing your search. Let me try a different approach."
        };
      }
      logTiming('rag_search');

      // 4. Generate search session (async, don't wait) - only for authenticated users
      if (isAuthenticated) {
        const searchSessionId = `search:${userId}:${Date.now()}`;
        const cacheStart = Date.now();
        redisService.cacheSearchSession(searchSessionId, {
          type: searchResult.type,
          searchId: searchResult.searchId || null,
          productIds: searchResult.type === 'database_search'
            ? (searchResult.productResults || []).map(item => item.id || item.hid).filter(Boolean)
            : [],
          category: searchResult.category,
          totalCount: searchResult.totalCount || 0,
          query: message,
          timestamp: Date.now(),
          queryId: searchResult.queryId || null
        }).catch(error => console.error('Error caching search session:', error));
        metrics.steps.redis_cache = Date.now() - cacheStart;
      }
      logTiming('redis_cache');

      // 5. Store conversation (completely async, don't wait at all) - only for authenticated users
      const conversationStoreStart = Date.now();
      if (isAuthenticated && conversationId && !skipMessageStorage) {
        // Validate conversationId is a valid UUID before using
        if (!validateUUIDv4(conversationId)) {
          console.warn('Invalid conversationId, skipping message storage:', conversationId);
        } else {
          const updateMessages = async () => {
            try {
              // Import models
              const { Conversation, Message } = require('../db');

              // Check if conversation exists, create if it doesn't
              let conversation = await Conversation.findByPk(conversationId);
              if (!conversation) {
                console.log(`Creating new conversation with ID: ${conversationId}`);
                try {
                  conversation = await Conversation.create({
                    id: conversationId,
                    userId: userId,
                    title: `Search: ${message.substring(0, 50)}...`
                  });
                } catch (createError) {
                  console.error('Failed to create conversation:', createError);
                  // If conversation creation fails, skip message storage
                  return;
                }
              }

              // Fetch the last user message for this conversation
              const lastUserMsg = await Message.findOne({
                where: { conversationId: conversationId, sender: 'user' },
                order: [['createdAt', 'DESC']]
              });
              // If the last user message matches the current message, treat as pagination (do not store duplicate)
              if (lastUserMsg && lastUserMsg.content && lastUserMsg.content.text === message) {
                // Pagination request, do not store duplicate messages or generate new assistant message
                console.log("trying to store user message twice");
              } else {
                // Store user message as simple text with type
                try {
                  await Message.create({
                    conversationId: conversationId,
                    sender: 'user',
                    content: { type: 'user_message', text: message }
                  });
                } catch (userMsgError) {
                  console.error('Failed to store user message:', userMsgError);
                  return;
                }

              }

              // Prepare assistant message content based on type
              let assistantContent;
              if (searchResult.type === 'database_search') {
                // Filter out null values and ensure we have valid objects
                const productResults = Array.isArray(searchResult.productResults) ? searchResult.productResults.filter(Boolean) : [];

                assistantContent = {
                  type: 'database_search',
                  searchId: searchResult.searchId,
                  products: productResults,
                  category: searchResult.category || 'products',
                  confidence: searchResult.confidence || 1.0,
                  filters: searchResult.detectedFilters || {}
                };
              }
              else if (searchResult.type === 'ai_chat') {
                assistantContent = {
                  type: 'ai_chat',
                  message: searchResult.message,
                  confidence: searchResult.confidence || 1.0,
                  model: searchResult.model
                };
              }
              else if (searchResult.type === 'web_search') {
                assistantContent = {
                  type: 'web_search',
                  queryId: searchResult.queryId,
                  message: searchResult.message,
                  sources: searchResult.sources || [],
                  confidence: searchResult.confidence || 1.0,
                  searchEngine: searchResult.searchEngine
                };
              }
              else {
                // Fallback for unknown type
                assistantContent = {
                  type: 'unknown',
                  message: searchResult.message || 'Here is what I found.',
                  confidence: searchResult.confidence || 1.0
                };
              }

              // Store assistant message (always wrap full response structure in content)
              try {
                console.log("Creating message storage");
                await Message.create({
                  conversationId: conversationId,
                  sender: 'assistant',
                  content: assistantContent
                });
              } catch (assistantMsgError) {
                console.error('Failed to store assistant message:', assistantMsgError);
              }
            } catch (err) {
              console.error('Error in async conversation handling:', err);
            }
          };
          // Realmente async: no await, solo catch errors
          updateMessages().catch(err => console.error('Async message storage error:', err));
        }
      }
      metrics.steps.conversation_store = Date.now() - conversationStoreStart;
      logTiming('conversation_store');

      // 6. Send response immediately
      let response;

      // Handle new clean response structure based on type
      if (searchResult.type === 'web_search') {
        response = {
          type: 'web_search',
          queryId: searchResult.queryId,
          message: searchResult.message,
          sources: searchResult.sources || [],
          confidence: searchResult.confidence || 1.0,
          searchEngine: searchResult.searchEngine
        };
      } else if (searchResult.type === 'ai_chat') {
        response = {
          type: 'ai_chat',
          message: searchResult.message,
          confidence: searchResult.confidence || 1.0,
          model: searchResult.model
        };
      } else {
        // Database search results (type: 'database_search')
        response = {
          type: 'database_search',
          searchId: searchResult.searchId,
          productResults: searchResult.productResults || [],
          pagination: {
            currentPage: searchResult.page || 1,
            totalPages: Math.ceil((searchResult.totalCount || 0) / (searchResult.limit || 50)),
            totalItems: searchResult.totalCount || 0,
            itemsPerPage: searchResult.limit || 50,
            hasNextPage: searchResult.hasMore || false,
            hasPreviousPage: (searchResult.page || 1) > 1
          },
          category: searchResult.category,
          confidence: searchResult.confidence || 1.0,
          filters: searchResult.detectedFilters || {}
        };
      }

      logTiming('response_preparation');

      // 7. Send response
      res.json(response);
      logTiming('response_sent');

      // 8. Log performance metrics
      const totalTime = Date.now() - startTime;
      metrics.totalTime = totalTime;
      metrics.timestamp = new Date().toISOString();

      // Log estructurado para análisis
      console.log(JSON.stringify({
        type: 'search_metrics',
        ...metrics
      }));

      // Log legible para debugging
      console.log('\n📊 Search Performance Breakdown:');
      console.log('--------------------------------');
      console.log(`Request ID: ${requestId}`);
      console.log(`auth_check          : 0ms`);
      console.log(`input_validation    : ${metrics.steps.input_validation || 1}ms`);
      console.log(`rag_search          : ${metrics.steps.rag_search || 0}ms`);
      if (metrics.steps.intentDetection) {
        console.log(`  └─ intent_detection: ${metrics.steps.intentDetection}ms`);
      }
      if (metrics.steps.embeddings) {
        console.log(`  └─ embeddings: ${metrics.steps.embeddings}ms`);
      }
      if (metrics.steps.vectorSearch) {
        console.log(`  └─ vector_search: ${metrics.steps.vectorSearch}ms`);
      }
      if (metrics.steps.redis_cache) {
        console.log(`redis_cache         : ${metrics.steps.redis_cache}ms`);
      }
      if (metrics.steps.conversation_store) {
        console.log(`conversation_store  : ${metrics.steps.conversation_store}ms`);
      }
      if (metrics.steps.response_preparation) {
        console.log(`response_preparation: ${metrics.steps.response_preparation}ms`);
      }
      if (metrics.steps.response_sent) {
        console.log(`response_sent       : ${metrics.steps.response_sent}ms`);
      }
      console.log(`Total time: ${totalTime}ms`);
      if (metrics.cache.result.hit || metrics.cache.embedding.hit) {
        console.log(`Cache: result=${metrics.cache.result.hit ? 'HIT' : 'MISS'}, embedding=${metrics.cache.embedding.hit ? 'HIT' : 'MISS'}`);
      }
      console.log('--------------------------------\n');

      // Almacenar métricas en Redis de forma async (no bloquea)
      this.storeMetricsAsync(metrics).catch(err => {
        console.warn('⚠️ Failed to store metrics:', err.message);
      });

    } catch (error) {
      console.error('Search error:', error);

      // Registrar error en métricas
      const totalTime = Date.now() - startTime;
      metrics.error = error.message;
      metrics.totalTime = totalTime;
      metrics.timestamp = new Date().toISOString();

      console.error(JSON.stringify({
        type: 'search_error',
        ...metrics
      }));

      // Almacenar métricas de error
      this.storeMetricsAsync(metrics).catch(err => {
        console.warn('⚠️ Failed to store error metrics:', err.message);
      });

      // Check if response has already been sent
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Search failed',
          message: error.message
        });
      }
    }
  }

  /**
   * Almacena métricas en Redis de forma async (no bloquea)
   */
  async storeMetricsAsync(metrics) {
    try {
      const key = `metrics:search:${Date.now()}:${metrics.requestId}`;
      const ttl = 7 * 24 * 60 * 60; // 7 días
      await redisService.cacheSearchResults(key, metrics, ttl);
    } catch (error) {
      // No bloquear si falla
      console.warn('⚠️ Failed to store metrics in Redis:', error.message);
    }
  }

  // Helper method to determine display format based on category
  getDisplayFormat(category) {
    switch (category) {
      case 'vehicles':
        return 'cards';
      case 'real_estate':
        return 'grid';
      case 'products':
        return 'list';
      default:
        return 'text';
    }
  }

  async performWebSearch(query) {
    try {
      // Use Brave Search API for web search results
      const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

      if (!braveApiKey) {
        console.warn('Brave Search API key not found. Using fallback method.');
        return this.performFallbackSearch(query);
      }

      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': braveApiKey
        },
        params: {
          q: query,
          count: 10,  // Number of results
          search_lang: 'en',
          country: 'US'
        }
      });

      if (!response.data || !response.data.web || !response.data.web.results || response.data.web.results.length === 0) {
        console.log('No web search results found from Brave Search, using fallback');
        return this.performFallbackSearch(query);
      }

      // Transform Brave Search results to our expected format
      return response.data.web.results.map(item => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.description || ''
      }));
    } catch (error) {
      console.error('Brave Search API error:', error);
      console.log('Using fallback search due to API error');
      return this.performFallbackSearch(query);
    }
  }

  async performFallbackSearch(query) {
    try {
      // Use OpenAI to generate a response when web search API is unavailable
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a knowledgeable assistant. The user has asked: "${query}"
              Provide a detailed, accurate response. If discussing cultural topics,
              be respectful and comprehensive. Include relevant facts and context.
              Format the response in a clear, engaging way.`
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      return [{
        title: "AI-Generated Response",
        url: "https://search.brave.com",
        snippet: completion.choices[0].message.content
      }];
    } catch (error) {
      console.error('Fallback search error:', error);
      return [{
        title: "Search Error",
        url: null,
        snippet: "I apologize, but I couldn't retrieve information for your query at this time. Please try again later."
      }];
    }
  }

  // Add a new endpoint to get performance metrics
  async getPerformanceMetrics(req, res) {
    try {
      res.json({
        metrics: performanceMetrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      res.status(500).json({ error: 'Failed to get performance metrics' });
    }
  }

  // Debug cache status
  async getCacheStatus(req, res) {
    try {
      const redis = require('../services/redisService');

      // Get cache keys pattern - we'll use a different approach since keys() might not be available
      const cacheStats = {
        total_complete_search_cache: 'Use Redis CLI to check: KEYS complete_search:*',
        total_analysis_cache: 'Use Redis CLI to check: KEYS query_analysis:*',
        total_intent_cache: 'Use Redis CLI to check: KEYS intent_analysis:*',
        note: 'Cache keys are stored with TTL of 1 hour. Use Redis CLI to inspect cache contents.'
      };

      res.json({
        cache_status: cacheStats,
        timestamp: new Date().toISOString(),
        redis_connection: 'Connected via redisService'
      });
    } catch (error) {
      console.error('Error getting cache status:', error);
      res.status(500).json({ error: 'Failed to get cache status' });
    }
  }

  // Clear cache for testing
  async clearCache(req, res) {
    try {
      const redis = require('../services/redisService');

      // Since we can't easily get all keys, we'll clear by pattern
      // This is a simplified approach - in production you might want to use Redis SCAN
      res.json({
        message: 'Cache clearing not implemented in this version. Use Redis CLI: FLUSHDB or FLUSHALL',
        note: 'Individual cache entries expire after 1 hour automatically',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  }

  // Get results by query ID
  async getResultsByQueryId(req, res) {
    try {
      const { queryId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      if (!queryId) {
        return res.status(400).json({ error: 'Query ID is required' });
      }

      const ragSearch = require('../services/search/ragService');
      const cachedData = await ragSearch.getCachedQueryResults(queryId);

      if (!cachedData) {
        return res.status(404).json({
          error: 'Query ID not found in cache',
          queryId,
          note: 'Query results expire after 1 hour. Make a new search to cache results.'
        });
      }

      // Apply pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedResults = cachedData.results.slice(startIndex, endIndex);

      res.json({
        queryId,
        results: paginatedResults,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(cachedData.results.length / parseInt(limit)),
          totalItems: cachedData.results.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: endIndex < cachedData.results.length,
          hasPreviousPage: parseInt(page) > 1
        },
        category: cachedData.category,
        fromCache: true,
        timestamp: cachedData.timestamp
      });

    } catch (error) {
      console.error('Error getting results by query ID:', error);
      res.status(500).json({ error: 'Failed to get results by query ID' });
    }
  }

  // New endpoint to fetch product details
  async getProductDetails(req, res) {
    try {
      const { searchSessionId, page = 1, limit = 20 } = req.query;

      if (!searchSessionId) {
        return res.status(400).json({ error: 'Search session ID is required' });
      }

      // Get search session from Redis
      const searchSession = await redisService.getSearchSession(searchSessionId);
      if (!searchSession) {
        return res.status(404).json({ error: 'Search session not found or expired' });
      }

      const offset = (page - 1) * limit;
      const productIds = searchSession.productIds.slice(offset, offset + limit);

      // Get detailed product information
      const detailedProducts = await this.fetchProductDetails(productIds);

      return res.json({
        products: detailedProducts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(searchSession.totalCount / limit),
          totalItems: searchSession.totalCount,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error fetching product details:', error);
      res.status(500).json({ error: 'Failed to fetch product details' });
    }
  }

  // Helper method to fetch product details with caching
  async fetchProductDetails(productIds) {
    const products = [];
    const uncachedIds = [];

    // Try to get products from cache first
    for (const id of productIds) {
      const cachedProduct = await redisService.getProductDetails(id);
      if (cachedProduct) {
        products.push(cachedProduct);
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached products from database
    if (uncachedIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT p.*, 
          json_agg(DISTINCT i.url) as images,
          json_agg(DISTINCT c.name) as categories,
          json_agg(DISTINCT t.name) as tags
         FROM products p
         LEFT JOIN product_images i ON p.id = i.product_id
         LEFT JOIN product_categories c ON p.id = c.product_id
         LEFT JOIN product_tags t ON p.id = t.product_id
         WHERE p.id = ANY($1)
         GROUP BY p.id`,
        [uncachedIds]
      );

      // Cache the fetched products
      for (const product of rows) {
        await redisService.cacheProductDetails(product.id, product);
        products.push(product);
      }
    }

    // Sort products to match the original order of IDs
    return productIds.map(id =>
      products.find(p => p.id === id)
    ).filter(Boolean);
  }

  // New endpoint to fetch full item details
  async getItemDetails(req, res) {
    const startTime = Date.now();
    try {
      const { category, ids } = req.body;

      if (!category || !ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid request parameters' });
      }

      // Check Redis cache first
      const cachedItems = await Promise.all(
        ids.map(id => redisService.getCachedResults(`${category}:item:${id}`))
      );

      const uncachedIds = ids.filter((id, index) => !cachedItems[index]);
      let items = cachedItems.filter(Boolean);

      if (uncachedIds.length > 0) {
        // Fetch uncached items from database
        const { rows } = await pool.query(
          `SELECT * FROM ${category} WHERE id = ANY($1)`,
          [uncachedIds]
        );

        // Cache the fetched items
        await Promise.all(
          rows.map(item =>
            redisService.cacheSearchResults(
              `${category}:item:${item.id}`,
              item,
              300 // 5 minutes
            )
          )
        );

        items = [...items, ...rows];
      }

      // Sort items to match the original order of IDs
      const sortedItems = ids.map(id =>
        items.find(item => item.id === id)
      ).filter(Boolean);

      return res.json({
        items: sortedItems,
        metrics: {
          responseTime: Date.now() - startTime,
          cachedCount: cachedItems.filter(Boolean).length,
          totalCount: items.length
        }
      });
    } catch (error) {
      console.error('Error fetching item details:', error);
      res.status(500).json({ error: 'Failed to fetch item details' });
    }
  }

  // Get results by search ID
  async getResultsBySearchId(req, res) {
    try {
      const { searchId } = req.params;
      let { page = 1, limit = 25, order_by_price = null } = req.query;

      if (!searchId) {
        return res.status(400).json({ error: 'Search ID is required' });
      }
      const orderBy = {};
      if (order_by_price && (order_by_price.toUpperCase() === "ASC" || order_by_price.toUpperCase() === "DESC")) {
        orderBy.price = order_by_price.toUpperCase();
      }

      const searchQueryService = require('../services/search/searchQueryService');

      const searchResults = await searchQueryService.getSearchResults(searchId, parseInt(page), parseInt(limit), orderBy);

      // Calculate pagination info

      res.json({
        productResults: searchResults.productResults,
        totalCount: searchResults.totalCount,
        page: page,
        hasMore: searchResults.hasMore
      });

    } catch (error) {
      console.error('Error getting results by search ID:', error);
      if (error.message.includes('not found')) {
        res.status(404).json({
          error: 'Search not found',
          searchId: req.params.searchId,
          note: 'Search may have expired or never existed.'
        });
      } else {
        res.status(500).json({ error: 'Failed to get results by search ID' });
      }
    }
  }

  // Get recent searches
  async getRecentSearches(req, res) {
    try {
      const { limit = 10 } = req.query;
      const searchQueryService = require('../services/search/searchQueryService');
      const searches = await searchQueryService.getRecentSearches(parseInt(limit));

      res.json({
        searches,
        count: searches.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting recent searches:', error);
      res.status(500).json({ error: 'Failed to get recent searches' });
    }
  }

  // Get popular searches
  async getPopularSearches(req, res) {
    try {
      const { limit = 10 } = req.query;
      const searchQueryService = require('../services/search/searchQueryService');
      const searches = await searchQueryService.getPopularSearches(parseInt(limit));

      res.json({
        searches,
        count: searches.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting popular searches:', error);
      res.status(500).json({ error: 'Failed to get popular searches' });
    }
  }
}

// Helper to fetch concise item summaries for OpenAI prompt
async function fetchItemSummaries(hids, category) {
  if (!hids || hids.length === 0) return [];
  const client = await pool.connect();
  try {
    let query;
    switch (category) {
      case 'products':
        query = 'SELECT hid, title, brand, price_value, images_url FROM products WHERE hid = ANY($1)';
        break;
      case 'vehicles':
        query = 'SELECT hid, brand, model, year, price_value, images_url FROM vehicles WHERE hid = ANY($1)';
        break;
      case 'real_estate':
        query = 'SELECT hid, location, price_value, property_type, images_url FROM real_estate WHERE hid = ANY($1)';
        break;
      default:
        return [];
    }
    const { rows } = await client.query(query, [hids]);
    return rows;
  } finally {
    client.release();
  }
}

module.exports = new SearchController(); 