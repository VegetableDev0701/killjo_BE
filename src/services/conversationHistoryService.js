const { ConversationHistory } = require('../db');


class ConversationHistoryService {
  async addMessageToHistory(conversationId, role, content) {
    try {
      const historyEntry = await ConversationHistory.create({
        conversationId,
        role,
        content
      });
      return historyEntry;
    } catch (error) {
      console.error('Error adding message to history:', error);
      throw error;
    }
  }

  async getConversationHistory(conversationId) {
    try {
      const history = await ConversationHistory.findAll({
        where: { conversationId},
        order: [['createdAt', 'ASC']],
        limit: 10 
      });
      return history.map(entry => ({
        role: entry.role,
        content: entry.content
      }));
    } catch (error) {
      console.error('Error getting conversation history:', error);
      throw error;
    }
  }
}

module.exports = new ConversationHistoryService();