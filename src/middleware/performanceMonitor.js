const redisService = require('../services/redisService');

// Performance monitoring middleware
const performanceMonitor = {
  // Track search performance metrics
  async trackSearchPerformance(req, res, next) {
    const startTime = Date.now();
    const originalSend = res.json;
    const self = this;
    
    // Override res.json to capture response time
    res.json = function(data) {
      const responseTime = Date.now() - startTime;
      
      // Track metrics asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await self.recordSearchMetrics(req, data, responseTime);
        } catch (error) {
          console.error('Error recording search metrics:', error);
        }
      });
      
      // Check if headers have already been sent
      if (!this.headersSent) {
        return originalSend.call(this, data);
      }
    };
    
    next();
  },

  // Record search performance metrics
  async recordSearchMetrics(req, responseData, responseTime) {
    try {
      const { message, page = 1, limit = 20, category } = req.body;
      const userId = req.user?.id || 'anonymous';
      
      const metrics = {
        timestamp: Date.now(),
        userId,
        query: message,
        category: responseData.category || category,
        responseTime,
        resultCount: responseData.results?.length || 0,
        totalCount: responseData.pagination?.totalItems || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        type: responseData.type,
        confidence: responseData.confidence || 0,
        language: responseData.language || 'en'
      };

      // Store in Redis with TTL (7 days)
      const metricsKey = `search_metrics:${Date.now()}`;
      await redisService.cacheSearchResults(metricsKey, JSON.stringify(metrics), 7 * 24 * 60 * 60);

      // Update aggregated metrics
      await this.updateAggregatedMetrics(metrics);
      
    } catch (error) {
      console.error('Error recording search metrics:', error);
    }
  },

  // Update aggregated performance metrics
  async updateAggregatedMetrics(metrics) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `search_metrics_daily:${today}`;
      const categoryKey = `search_metrics_category:${metrics.category}:${today}`;
      
      // Get existing metrics
      const existingDaily = await redisService.getCachedResults(dailyKey);
      const existingCategory = await redisService.getCachedResults(categoryKey);
      
      const dailyMetrics = existingDaily ? JSON.parse(existingDaily) : {
        totalSearches: 0,
        avgResponseTime: 0,
        totalResults: 0,
        categories: {},
        responseTimes: []
      };
      
      const categoryMetrics = existingCategory ? JSON.parse(existingCategory) : {
        totalSearches: 0,
        avgResponseTime: 0,
        totalResults: 0,
        responseTimes: []
      };

      // Update daily metrics
      dailyMetrics.totalSearches++;
      dailyMetrics.totalResults += metrics.resultCount;
      dailyMetrics.responseTimes.push(metrics.responseTime);
      dailyMetrics.avgResponseTime = dailyMetrics.responseTimes.reduce((a, b) => a + b, 0) / dailyMetrics.responseTimes.length;
      
      if (!dailyMetrics.categories[metrics.category]) {
        dailyMetrics.categories[metrics.category] = 0;
      }
      dailyMetrics.categories[metrics.category]++;

      // Update category metrics
      categoryMetrics.totalSearches++;
      categoryMetrics.totalResults += metrics.resultCount;
      categoryMetrics.responseTimes.push(metrics.responseTime);
      categoryMetrics.avgResponseTime = categoryMetrics.responseTimes.reduce((a, b) => a + b, 0) / categoryMetrics.responseTimes.length;

      // Store updated metrics (24 hour TTL)
      await redisService.cacheSearchResults(dailyKey, JSON.stringify(dailyMetrics), 24 * 60 * 60);
      await redisService.cacheSearchResults(categoryKey, JSON.stringify(categoryMetrics), 24 * 60 * 60);

    } catch (error) {
      console.error('Error updating aggregated metrics:', error);
    }
  },

  // Get performance metrics
  async getPerformanceMetrics(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `search_metrics_daily:${today}`;
      
      const dailyMetrics = await redisService.getCachedResults(dailyKey);
      
      if (!dailyMetrics) {
        return res.json({
          today: {
            totalSearches: 0,
            avgResponseTime: 0,
            totalResults: 0,
            categories: {}
          },
          recommendations: []
        });
      }

      const metrics = JSON.parse(dailyMetrics);
      
      // Generate performance recommendations
      const recommendations = this.generateRecommendations(metrics);
      
      res.json({
        today: metrics,
        recommendations
      });
      
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      res.status(500).json({ error: 'Failed to get performance metrics' });
    }
  },

  // Generate performance recommendations
  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.avgResponseTime > 5000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Average response time is high (>5s). Consider optimizing database queries or adding more indexes.',
        action: 'Run database optimization script'
      });
    }
    
    if (metrics.avgResponseTime > 2000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Response time could be improved. Consider implementing caching strategies.',
        action: 'Review caching implementation'
      });
    }
    
    if (metrics.totalResults / metrics.totalSearches < 1) {
      recommendations.push({
        type: 'search_quality',
        priority: 'medium',
        message: 'Low result count per search. Consider improving search relevance.',
        action: 'Review search algorithms'
      });
    }
    
    return recommendations;
  }
};

module.exports = performanceMonitor; 