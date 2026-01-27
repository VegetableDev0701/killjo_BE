const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const wrapAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};


// Apply authentication middleware to all routes
router.use(authenticate);

router.post('/', wrapAsync(chatController.createConversation));
router.get('/', wrapAsync(chatController.getConversations));
router.post('/pin',wrapAsync(chatController.toggleFavorite))
router.get('/:conversationId', wrapAsync(chatController.getConversation));
router.patch('/:conversationId/title', wrapAsync(chatController.updateConversationTitle));

router.post('/:conversationId/messages', wrapAsync(chatController.addMessage));

// Delete single conversation endpoint
router.delete('/:conversationId', wrapAsync(chatController.deleteConversation));

// Delete all conversations endpoint
router.delete('/all', wrapAsync(chatController.deleteAllConversations));





module.exports = router;  