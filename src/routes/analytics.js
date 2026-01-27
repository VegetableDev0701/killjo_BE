const express = require('express');
const router = express.Router();
const analyticsController = require('../analytics/analyticsController');
const analyticsAccessController = require('../analytics/analyticsAccessController');
const { authenticateToken } = require('../middleware/auth');

// Track click conversion
router.post('/click/product', authenticateToken, analyticsController.trackClickConversion);
router.get('/click-conversion', authenticateToken, analyticsController.getClickConversionStats);
router.get('/top-searches', authenticateToken, analyticsController.getTopSearchesStats);
router.get('/location-stats', authenticateToken, analyticsController.getLocationStats);
router.get('/trending-categories', authenticateToken, analyticsController.getTendingCategoryStats);
router.get('/report/download', authenticateToken, analyticsController.downloadReport);

///// Temporary Pending Access Approval Routes /////

router.get('/pending-users', analyticsAccessController.getPendingAccessUsers);
router.get('/pending-users/approve', analyticsAccessController.approveUser);

module.exports = router;
