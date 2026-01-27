const express = require('express');
const router = express.Router();
const labsController = require('../controllers/labsController');

// Note: We're using optionalAuthenticateToken middleware from app.js
// which is already applied globally, so we don't need to apply it here again.
// The controller will check req.user to determine if user is authenticated.

// Get bulk article stats
// POST /labs/articles
// Body: { articleIds: string[] }
router.post('/articles', labsController.getBulkArticleStats.bind(labsController));

// Record article view
// POST /labs/articles/:id/view
router.post('/articles/:id/view', labsController.recordArticleView.bind(labsController));

// Toggle article like
// POST /labs/articles/:id/like
router.post('/articles/:id/like', labsController.toggleArticleLike.bind(labsController));

module.exports = router;
