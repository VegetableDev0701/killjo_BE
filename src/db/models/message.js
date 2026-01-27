const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Message extends Model {}

  Message.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'conversations',
        key: 'id'
      },
      field: 'conversation_id'
    },
    sender: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false
    },
    content: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      get() {
        const rawValue = this.getDataValue('content');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : {};
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    sequelize,
    modelName: 'Message',
    tableName: 'messages',
    timestamps: true,
    indexes: [
      {
        fields: ['conversation_id']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['sender']
      }
    ]
  });

  return Message;
}; 