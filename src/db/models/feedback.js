const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Feedback extends Model { }

    Feedback.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 5
            }
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Feedback',
        tableName: 'feedbacks',
        timestamps: true // This will add createdAt and updatedAt fields automatically
    });

    return Feedback;
}

