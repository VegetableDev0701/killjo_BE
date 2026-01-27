const chatService = require('../services/chatService');
const { validateUUID } = require('../utils/validation');

class ChatController {
  async createConversation(req, res) {
    try {
      const { title } = req.body;
      const userId = req.user.id;

      const conversation = await chatService.createConversation(userId, title);
      res.status(201).json(conversation);
    } catch (error) {
      console.error('Error in createConversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }

  async getConversations(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10, page = 1 } = req.query;
      const { favoritesOnly } = req.query;
      
      const result = await chatService.getConversations(userId, {
        favoritesOnly: favoritesOnly === 'true',
        limit,
        page
      });
      
      // Structure response with pagination info
      res.json({
        conversations: result.conversations || result,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(result.total / limit),
          hasMore: result.total > (page * limit)
        }
      });
    } catch (error) {
      console.error('Error in getConversations:', error);
      res.status(500).json({ error: 'Failed to get conversations' });
    }
  }

  async getFavoriteConversations(req, res) {
    try {
      const userId = req.user.id;
      const conversations = await chatService.getConversations(userId, { favoritesOnly: true });
      res.json(conversations);
    } catch (error) {
      console.error('Error in getFavoriteConversations:', error);
      res.status(500).json({ error: 'Failed to get favorite conversations' });
    }
  }

  async getConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      if (!validateUUID(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
      }

      const conversation = await chatService.getConversation(conversationId, userId);
      res.json(conversation);
    } catch (error) {
      console.error('Error in getConversation:', error);
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
      } else {
        res.status(500).json({ error: 'Failed to get conversation' });
      }
    }
  }

  async addMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      if (!validateUUID(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
      }

      if (!content || typeof content !== 'object') {
        return res.status(400).json({ error: 'Invalid message content' });
      }

      const message = await chatService.addMessage(conversationId, userId, 'user', content);
      res.status(201).json(message);
    } catch (error) {
      console.error('Error in addMessage:', error);
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
      } else {
        res.status(500).json({ error: 'Failed to add message' });
      }
    }
  }

  async updateConversationTitle(req, res) {
    try {
      const { conversationId } = req.params;
      const { title } = req.body;
      const userId = req.user.id;

      if (!validateUUID(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
      }

      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Invalid title' });
      }

      const conversation = await chatService.updateConversationTitle(conversationId, userId, title);
      res.json(conversation);
    } catch (error) {
      console.error('Error in updateConversationTitle:', error);
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
      } else if (error.message === 'Invalid title') {
        res.status(400).json({ error: 'Invalid title' });
      } else {
        res.status(500).json({ error: 'Failed to update conversation title' });
      }
    }
  }

  async toggleFavorite(req, res) {
    try {
      const { chatId } = req.body;
      const userId = req.user.id;

      if (!validateUUID(chatId)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
      }

      const conversation = await chatService.toggleFavorite(chatId, userId);
      res.json(conversation);
    } catch (error) {
      console.error('Error in toggleFavorite:', error);
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
      } else {
        res.status(500).json({ error: 'Failed to toggle favorite status' });
      }
    }
  }

  async deleteConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      if (!validateUUID(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
      }

      await chatService.deleteConversation(conversationId, userId);
      res.status(204).send();
    } catch (error) {
      console.error('Error in deleteConversation:', error);
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
      } else {
        res.status(500).json({ error: 'Failed to delete conversation' });
      }
    }
  }

  async deleteAllConversations(req, res) {
    try {
      const userId = req.user.id;
      const { confirm } = req.body;

      // Require explicit confirmation to prevent accidental deletion
      if (!confirm || confirm !== 'true') {
        return res.status(400).json({ 
          error: 'Confirmation required. Set confirm to "true" to delete all conversations.' 
        });
      }

      const result = await chatService.deleteAllConversations(userId);
      res.json({
        message: 'All conversations deleted successfully',
        deletedCount: result.deletedCount
      });
    } catch (error) {
      console.error('Error in deleteAllConversations:', error);
      res.status(500).json({ error: 'Failed to delete all conversations' });
    }
  }

  async transcribeAudio(req, res) {
    try {
      const audioFile = req.file; 

      console.log(audioFile);

      if (!audioFile || !audioFile.buffer) {
        return res.status(400).json({ 
          error: 'Audio file is required. Please upload an audio file.' 
        });
      }

      const TranscriptionService = require('../services/openAi/transcriptionService');
      const transcriptionService = new TranscriptionService();

      // Transcribe the audio (audioFile is now a Buffer from multer)
      const result = await transcriptionService.transcribeAudio(audioFile);

      res.json({
        success: true,
        transcription: result.text,
        timestamp: new Date().toISOString(),
        fileInfo: {
          originalName: audioFile.originalname,
          size: audioFile.size,
          mimetype: audioFile.mimetype
        }
      });
    } catch (error) {
      console.error('Error in transcribeAudio:', error);
      
      // Handle specific errors
      if (error.message.includes('Audio file size exceeds')) {
        return res.status(413).json({ error: 'Audio file is too large. Maximum size is 25MB.' });
      } else if (error.message.includes('Unsupported audio format')) {
        return res.status(400).json({ error: 'Unsupported audio format. Supported formats: mp3, wav, m4a, mp4, webm' });
      } else if (error.message.includes('Rate limit exceeded')) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      } else if (error.message.includes('Invalid OpenAI API key')) {
        return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
      }
      
      res.status(500).json({ 
        error: 'Failed to transcribe audio',
        details: error.message 
      });
    }
  }

}

module.exports = new ChatController(); 