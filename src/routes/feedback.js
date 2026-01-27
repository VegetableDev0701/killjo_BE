const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/feedbackController');
const { authenticate } = require('../middleware/auth');
const wrapAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};


// Apply authentication middleware to all routes
router.use(authenticate);

router.post('/', wrapAsync(FeedbackController.createFeedback));

module.exports = router;
