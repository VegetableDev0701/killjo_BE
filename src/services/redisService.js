const Redis = require('ioredis');
const { promisify } = require('util');

class RedisService {
  constructor() {
    // Ensure REDIS_DB is a valid integer
    const dbNumber = parseInt(process.env.REDIS_DB || '0', 10);
    
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: isNaN(dbNumber) ? 0 : dbNumber,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.client.on('error', (err) => console.error('Redis Client Error:', err));
    this.client.on('connect', () => console.log('Redis Client Connected'));
  }

  // Generate cache key for search results
  generateSearchKey(category, query, language, userId) {
    return `search:${category}:${userId}:${language}:${query}`;
  }

  // Cache search results with expiration
  async cacheSearchResults(key, results, expirationSeconds = 3600) {
    try {
      const serializedResults = JSON.stringify(results);
      await this.client.setex(key, expirationSeconds, serializedResults);
      return true;
    } catch (error) {
      console.error('Redis cache error:', error);
      return false;
    }
  }

  // Get cached search results
  async getCachedResults(key) {
    try {
      const cachedResults = await this.client.get(key);
      return cachedResults ? JSON.parse(cachedResults) : null;
    } catch (error) {
      console.error('Redis get cache error:', error);
      return null;
    }
  }

  // Invalidate cache for a specific category
  async invalidateCategoryCache(category, userId) {
    try {
      const pattern = `search:${category}:${userId}:*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis invalidate cache error:', error);
      return false;
    }
  }

  // Track search analytics
  async trackSearch(category, query, userId, metadata = {}) {
    try {
      const searchKey = `search:analytics:${userId}:${Date.now()}`;
      const searchData = {
        category,
        query,
        userId,
        timestamp: Date.now(),
        ...metadata
      };
      await this.client.setex(searchKey, 86400 * 30, JSON.stringify(searchData)); // Store for 30 days
      return true;
    } catch (error) {
      console.error('Redis track search error:', error);
      return false;
    }
  }

  // Get search analytics for a user
  async getSearchAnalytics(userId, period = 30) {
    try {
      const pattern = `search:analytics:${userId}:*`;
      const keys = await this.client.keys(pattern);
      const analytics = [];
      
      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const searchData = JSON.parse(data);
          const searchDate = new Date(searchData.timestamp);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - period);
          
          if (searchDate >= cutoffDate) {
            analytics.push(searchData);
          }
        }
      }
      
      return analytics;
    } catch (error) {
      console.error('Redis get analytics error:', error);
      return [];
    }
  }

  // Clear all cache for a user
  async clearUserCache(userId) {
    try {
      const patterns = [
        `search:*:${userId}:*`,
        `search:analytics:${userId}:*`
      ];
      
      for (const pattern of patterns) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      }
      return true;
    } catch (error) {
      console.error('Redis clear user cache error:', error);
      return false;
    }
  }

  // Cache search session with product IDs
  async cacheSearchSession(sessionId, data) {
    try {
      const serializedData = JSON.stringify(data);
      // Cache for 5 minutes
      await this.client.setex(sessionId, 300, serializedData);
      return true;
    } catch (error) {
      console.error('Redis cache search session error:', error);
      return false;
    }
  }

  // Get search session
  async getSearchSession(sessionId) {
    try {
      const data = await this.client.get(sessionId);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get search session error:', error);
      return null;
    }
  }

  // Cache product details
  async cacheProductDetails(productId, product) {
    try {
      const key = `product:${productId}`;
      const serializedProduct = JSON.stringify(product);
      // Cache for 1 hour
      await this.client.setex(key, 3600, serializedProduct);
      return true;
    } catch (error) {
      console.error('Redis cache product details error:', error);
      return false;
    }
  }

  // Get product details from cache
  async getProductDetails(productId) {
    try {
      const key = `product:${productId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get product details error:', error);
      return null;
    }
  }

  // Invalidate product cache
  async invalidateProductCache(productId) {
    try {
      const key = `product:${productId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis invalidate product cache error:', error);
      return false;
    }
  }

  // Cache boosted merchants list
  async cacheBoostedMerchants(data, expirationSeconds = 3600) {
    try {
      const key = 'boosted_merchants:list';
      const serializedData = JSON.stringify(data);
      await this.client.setex(key, expirationSeconds, serializedData);
      console.log('✅ Cached boosted merchants list');
      return true;
    } catch (error) {
      console.error('Redis cache boosted merchants error:', error);
      return false;
    }
  }

  // Get cached boosted merchants list
  async getCachedBoostedMerchants() {
    try {
      const key = 'boosted_merchants:list';
      const cachedData = await this.client.get(key);
      if (cachedData) {
        console.log('✅ Retrieved boosted merchants from cache');
      }
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      console.error('Redis get cached boosted merchants error:', error);
      return null;
    }
  }

  // Invalidate boosted merchants cache (call when boost is purchased)
  async invalidateBoostedMerchantsCache() {
    try {
      const key = 'boosted_merchants:list';
      await this.client.del(key);
      console.log('✅ Invalidated boosted merchants cache');
      return true;
    } catch (error) {
      console.error('Redis invalidate boosted merchants cache error:', error);
      return false;
    }
  }
}

module.exports = new RedisService();
