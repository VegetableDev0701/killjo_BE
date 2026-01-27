const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const rateLimit = require('express-rate-limit');
const { optionalAuthenticateToken } = require('../middleware/auth');
const performanceMonitor = require('../middleware/performanceMonitor');

// Apply optional authentication middleware to all search routes
router.use(optionalAuthenticateToken);

// Unified search endpoints with performance monitoring
router.post('/unified',  performanceMonitor.trackSearchPerformance.bind(performanceMonitor), searchController.unifiedSearch.bind(searchController));

// Product details endpoint
router.get('/products/details',  searchController.getProductDetails.bind(searchController));

// Performance metrics endpoint
router.get('/metrics', searchController.getPerformanceMetrics.bind(searchController));

// Debug cache endpoint
router.get('/debug/cache', searchController.getCacheStatus.bind(searchController));

// Clear cache endpoint (for testing)
router.post('/debug/clear-cache', searchController.clearCache.bind(searchController));

// Get results by search ID (for pagination) //see more
router.get('/by-id/:searchId', searchController.getResultsBySearchId.bind(searchController));

// Get recent searches
router.get('/recent', searchController.getRecentSearches.bind(searchController));

// Get popular searches
router.get('/popular', searchController.getPopularSearches.bind(searchController));

module.exports = router; 