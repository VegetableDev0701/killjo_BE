const crypto = require('crypto');
const responseGenerator = require('./responseGenerator');
const intentDetector = require('./intentDetector');
const ConversationHistoryService = require('../conversationHistoryService');
const DatabaseSearchService = require('./databaseSearchService');
const SearchQueryService = require('./searchQueryService');
const redisService = require('../redisService');
const { Conversation } = require('../../db');

class RAGSearchService {
  constructor() {
    this.intentDetector = intentDetector;
    // Variables legacy eliminadas (no se usan):
    // - embeddingModel, embeddingDimension, maxResults, similarityThreshold
    // - transformers, conversationHistory
  }

  pushHistory(conversationId, query, sender) {
    // add data to conversation history
    if (sender === 'assistant') {
      const finalResponse = responseGenerator.extractMetadatFromRespose(query);
      ConversationHistoryService.addMessageToHistory(conversationId, sender, finalResponse)
    } else {
      // For user queries, just store the raw query
      ConversationHistoryService.addMessageToHistory(conversationId, sender, query);
    }

  }

  getHistoryByChatId(chatId) {
    return ConversationHistoryService.getConversationHistory(chatId);
  }

  // Main search method with intent routing
  async search(query, page = 1, limit = 50, conversationId, option) {
    const metrics = {
      intentDetection: 0,
      embeddings: 0,
      vectorSearch: 0,
      embeddingCache: { hit: false, miss: false, error: false }
    };

    try {
      console.log(`🔍 Starting search for: "${query}" (page: ${page}, limit: ${limit})`);

      const Chathistory = await this.getHistoryByChatId(conversationId);

      // Normalize querry based on previous searches
      this.pushHistory(conversationId, query, 'user');

      // Detect intent and extract filters
      const searchStart = Date.now();
      const intentStart = Date.now();

      const intentResult = await this.intentDetector.detectIntent(query, Chathistory);

      metrics.intentDetection = Date.now() - intentStart;

      // Verificar cache de resultados completos (solo para DATABASE_SEARCH)
      // IMPORTANTE: Solo después de detectar intent, porque necesitamos category y filters
      const cacheEnabled = process.env.ENABLE_RESULT_CACHE === 'true';
      let cachedResult = null;

      if (cacheEnabled && intentResult.intent === 'DATABASE_SEARCH') {
        try {
          // Generar cache key completo con intentResult
          const cacheKey = this.generateSearchCacheKey(query, page, limit, intentResult);
          cachedResult = await redisService.getCachedResults(cacheKey);

          if (cachedResult && this.isValidCachedResult(cachedResult)) {
            console.log('✅ Search result from cache');
            // Retornar copia para no mutar el objeto en Redis
            return {
              ...cachedResult,
              _cached: true,
              _cacheTimestamp: Date.now(),
              metrics: {
                ...metrics,
                // Preservar métricas del cache si existen
                ...(cachedResult.metrics || {})
              }
            };
          }
        } catch (error) {
          // Si Redis falla, continuar sin cache (no bloquear)
          console.warn('⚠️ Redis cache error, continuing without cache:', error.message);
        }
      }

      const { userName } = option || {};

      let conversation;
      if (userName) {
        conversation = await Conversation.findByPk(conversationId);
      }


      let language = intentResult.language;

      if (conversation) {
        const metadata = conversation.metadata || {};
        if (metadata.language) {
          language = metadata.language;
        } else {
          language = intentResult.language;
          conversation.set('metadata', { ...metadata, language });
          await conversation.save();
        }
        // Handle language change intent
        if (intentResult.language_change) {
          language = intentResult.language_change;
          conversation.set('metadata', { ...metadata, language });
          await conversation.save();
        }

      }


      console.log('🎯 Intent detection result:', JSON.stringify(intentResult, null, 2));

      console.log(`⏱️ intentResult: ${Date.now() - searchStart}ms`);

      // Route based on intent
      let response;
      switch (intentResult.intent) {

        case 'TERMINAL':
          // Minimal acknowledgment response - no AI, no DB, no web, no cache
          const terminalMessage = language === 'es' ? 'De nada.' : 'No problem.';
          // ⏱ delay realistic response time
          await new Promise(resolve => setTimeout(resolve, 500));
          response = {
            type: 'ai_chat',
            message: terminalMessage,
            confidence: 1.0,
            intent: 'TERMINAL',
            reason: intentResult.reason,
            closeConversation: true,
            model: null,
            tokens: 0
          };
          break;
        case 'ASK_FOR_CLARIFICATION':
          response = {
            type: 'ai_chat',
            message: intentResult.asked_Question,
            confidence: intentResult.confidence || 1.0,
            intent: 'ai_chat',
            reason: intentResult.reason,
            model: 'gpt-4o-mini',
            tokens: 0,
          }
          break;
        case 'WEB_SEARCH':
          response = await this.handleWebSearch(intentResult, page, limit, language);
          break;
        case 'AI_CHAT':
          response = await this.handleAIChat(intentResult, page, limit, Chathistory, userName, language);
          break;
        default:
          const dbSearchStart = Date.now();
          const { location } = option || {};
          response = await DatabaseSearchService.search(query, intentResult, page, limit, conversationId, language, location);
          metrics.vectorSearch = Date.now() - dbSearchStart;

          // Incluir métricas de embeddings si están disponibles
          if (response.metrics) {
            metrics.embeddings = response.metrics.embeddings || 0;
            if (response.metrics.embeddingCache) {
              metrics.embeddingCache = response.metrics.embeddingCache;
            }
          }

          // Cachear resultado solo si es DATABASE_SEARCH y cache está habilitado
          // Cachear ANTES de añadir métricas locales para no contaminar el cache
          if (cacheEnabled && response.type === 'database_search') {
            try {
              // Generar cache key completo con intentResult
              const cacheKey = this.generateSearchCacheKey(query, page, limit, intentResult);
              const ttl = parseInt(process.env.RESULT_CACHE_TTL || '300', 10); // 5 min default
              // Cachear copia del objeto para no mutar el original
              await redisService.cacheSearchResults(cacheKey, { ...response }, ttl);
            } catch (error) {
              // Si cache falla, continuar (no crítico)
              console.warn('⚠️ Failed to cache result, continuing:', error.message);
            }
          }

          console.log(`⏱️ database: ${Date.now() - searchStart}ms`);
          break;
      }

      // Añadir métricas a la respuesta
      response.metrics = metrics;

      return response;
    } catch (error) {
      console.error('❌ Search error:', error);
      throw error;
    }
  }


  async handleWebSearch(intentResult, page, limit, language) {
    console.log('🌐 Handling web search...');

    const webSearchService = require('./webSearchService');
    const searchResult = await webSearchService.search(intentResult.normalized_query, page, limit, language);

    // Generate a unique query ID for web search
    const queryId = SearchQueryService.generateSearchId(intentResult.normalized_query, 'web_search');

    return {
      type: 'web_search',
      queryId: queryId,
      message: searchResult.aiSummary || searchResult.message || `Found ${searchResult.totalCount || 0} web results for "${intentResult.normalized_query}"`,
      totalCount: searchResult.totalCount || 0,
      page: page,
      hasMore: searchResult.hasMore || false,
      confidence: searchResult.confidence || 1.0,
      intent: intentResult.intent,
      reason: intentResult.reason,
      searchEngine: searchResult.searchEngine,
      sources: searchResult.results || []
    };
  }

  async handleAIChat(intentResult, page, limit, history, userName, language) {
    console.log('🤖 Handling AI chat...');

    const aiChatService = require('./aiChatService');

    const chatResult = await aiChatService.chat(intentResult.normalized_query, { language: language }, history || [], userName);

    return {
      type: 'ai_chat',
      message: chatResult.message,
      confidence: chatResult.confidence || 1.0,
      intent: intentResult.intent,
      reason: intentResult.reason,
      model: chatResult.model,
      tokens: chatResult.tokens
    };
  }

  /**
   * Genera clave de cache con TODOS los parámetros que afectan el resultado
   * 
   * Parámetros que afectan el resultado:
   * - query (normalizado)
   * - page
   * - limit
   * - category (del intentResult)
   * - filters (del intentResult, ordenado)
   * 
   * Parámetros que NO afectan el resultado:
   * - conversationId (el resultado es el mismo)
   * - language (ya está en el resultado)
   */
  generateSearchCacheKey(query, page, limit, intentResult = null) {
    // Normalizar query
    const normalizedQuery = this.normalizeTextForCache(query);

    // Si tenemos intentResult, incluir parámetros que afectan el resultado
    let keyData = {
      query: normalizedQuery,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    };

    // Si intentResult está disponible, incluir category y filters
    if (intentResult) {
      keyData.category = intentResult.category || 'vehicles';

      // Normalizar filters (ordenar keys para consistencia)
      if (intentResult.filters && Object.keys(intentResult.filters).length > 0) {
        const sortedFilters = {};
        Object.keys(intentResult.filters)
          .sort()
          .forEach(key => {
            sortedFilters[key] = intentResult.filters[key];
          });
        keyData.filters = sortedFilters;
      } else {
        keyData.filters = {};
      }
    }

    // Generar hash determinístico
    const keyString = JSON.stringify(keyData);
    return `search:complete:${crypto
      .createHash('sha256')
      .update(keyString)
      .digest('hex')}`;
  }

  /**
   * Valida que el resultado cacheado sea válido
   */
  isValidCachedResult(cached) {
    if (!cached || typeof cached !== 'object') {
      return false;
    }

    // Debe tener estructura de database_search
    if (cached.type !== 'database_search') {
      return false;
    }

    // Debe tener productResults (puede ser array vacío)
    if (!Array.isArray(cached.productResults)) {
      return false;
    }

    return true;
  }

  /**
   * Normaliza texto para cache consistente
   */
  normalizeTextForCache(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .normalize('NFC') // Normaliza Unicode
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normaliza espacios múltiples
      .replace(/[\x00-\x1F\x7F]/g, ''); // Elimina caracteres de control
  }

  // Método legacy no utilizado - eliminado para evitar código muerto
  // Si se necesita en el futuro, implementar getCachedSearchResult() o usar search() directamente

}

module.exports = new RAGSearchService(); 