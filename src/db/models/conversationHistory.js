const { Model, DataTypes } = require('sequelize');


module.exports = (sequelize) => {
    class ConversationHistoryModel extends Model {}
    
    ConversationHistoryModel.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        conversationId: {
            type: DataTypes.STRING,
            allowNull: false,
            index: true
        },
        role: {
            type: DataTypes.ENUM('user', 'assistant', 'system'),
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'ConversationHistory',
        tableName: 'conversation_histories',
        timestamps: true,
        indexes: [
            {
                name: 'conversation_id_index',
                fields: ['conversationId']
            }
        ]
    });
    
    return ConversationHistoryModel;
}