const { Conversation, Message } = require('../db');

class ChatService {
  async createConversation(userId, title = 'New Conversation') {
    try {
      const conversation = await Conversation.create({
        userId,
        title,
        metadata: {}
      });
      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async getConversations(userId, options = {}) {
    try {
      const where = { userId };
      
      // Add favorite filter if specified
      if (options.favoritesOnly) {
        where.is_favorite = true;
      }
      // Pagination
      const limit = options.limit ? parseInt(options.limit) : 10;
      const page = options.page ? parseInt(options.page) : 1;
      const offset = (page - 1) * limit;

      const { rows: conversations, count: total } = await Conversation.findAndCountAll({
        where,
        order: [
          // Sort favorites first, then by updatedAt
          ['is_favorite', 'DESC'],
          ['updatedAt', 'DESC']
        ],
        limit,
        offset
      });
      
      return {
        conversations,
        total
      };
    } catch (error) {
      console.error('Error getting conversations:', error);
      throw error;
    }
  }

  async getConversation(conversationId, userId) {
    try {
      const conversation = await Conversation.findOne({
        where: { id: conversationId, userId },
        include: [{
          model: Message,
          order: [['createdAt', 'ASC']]
        }]
      });
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      return conversation;
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  }

  async getMessages(conversationId, userId, options = {}) {
    try {
      const where = { conversationId };
      // Only allow access if user owns the conversation
      const conversation = await Conversation.findOne({ where: { id: conversationId, userId } });
      if (!conversation) throw new Error('Conversation not found');
      // Time-based filters
      if (options.since) where.createdAt = { ...(where.createdAt || {}), $gte: options.since };
      if (options.until) where.createdAt = { ...(where.createdAt || {}), $lte: options.until };
      // After filter (for pagination)
      if (options.after) where.createdAt = { ...(where.createdAt || {}), $gt: options.after };
      // Badge size filter (limit)
      const limit = options.limit ? parseInt(options.limit) : 50;
      const messages = await Message.findAll({
        where,
        order: [['createdAt', 'ASC']],
        limit
      });
      return messages;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  async addMessage(conversationId, userId, sender, content) {
    try {
      // Verify conversation exists and belongs to user
      const conversation = await Conversation.findOne({
        where: { id: conversationId, userId }
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Create message (createdAt is set automatically)
      const message = await Message.create({
        conversationId,
        sender,
        content
      });

      // Update conversation's updatedAt timestamp
      await conversation.update({ updatedAt: new Date() });

      return message;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  async updateConversationTitle(conversationId, userId, title) {
    try {
      const conversation = await Conversation.findOne({
        where: { id: conversationId, userId }
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Validate title
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw new Error('Invalid title');
      }

      // Trim and limit title length
      const trimmedTitle = title.trim().slice(0, 100);

      await conversation.update({ title: trimmedTitle });
      return conversation;
    } catch (error) {
      console.error('Error updating conversation title:', error);
      throw error;
    }
  }

  async toggleFavorite(conversationId, userId) {
    try {
      const conversation = await Conversation.findOne({
        where: { id: conversationId, userId }
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Toggle the favorite status
      await conversation.update({ is_favorite: !conversation.is_favorite });
      await conversation.reload();
      return conversation;
    } catch (error) {
      console.error('Error toggling conversation favorite status:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId, userId) {
    try {
      const conversation = await Conversation.findOne({
        where: { id: conversationId, userId }
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Delete all messages first (due to foreign key constraint)
      await Message.destroy({
        where: { conversationId }
      });

      // Delete conversation
      await conversation.destroy();
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  async deleteAllConversations(userId) {
    try {
      // Get all conversations for the user
      const conversations = await Conversation.findAll({
        where: { userId },
        attributes: ['id']
      });
      console.log(conversations.length);

      if (conversations.length === 0) {
        return { deletedCount: 0 };
      }

      const conversationIds = conversations.map(conv => conv.id);

      // Delete all messages for these conversations first (due to foreign key constraint)
      await Message.destroy({
        where: { conversationId: conversationIds }
      });

      // Delete all conversations
      await Conversation.destroy({
        where: { userId }
      });

      return { deletedCount: conversations.length };
    } catch (error) {
      console.error('Error deleting all conversations:', error);
      throw error;
    }
  }

}

module.exports = new ChatService(); 