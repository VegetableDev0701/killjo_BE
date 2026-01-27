const { Model, DataTypes } = require('sequelize');

const ArticleLike = (sequelize) => {
  class ArticleLike extends Model { }

  ArticleLike.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    articleId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'article_id',
      references: {
        model: 'articles',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'User ID if authenticated, null for anonymous users'
    },
    deviceId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'device_id',
      comment: 'Device identifier for tracking anonymous users'
    },
    likedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'liked_at'
    }
  }, {
    sequelize,
    modelName: 'ArticleLike',
    tableName: 'article_likes',
    underscored: true,
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['article_id', 'user_id'],
        name: 'article_likes_article_user_unique',
        where: {
          user_id: { [sequelize.Sequelize.Op.ne]: null }
        }
      },
      {
        unique: true,
        fields: ['article_id', 'device_id'],
        name: 'article_likes_article_device_unique',
        where: {
          user_id: null
        }
      },
      {
        fields: ['article_id']
      },
      {
        fields: ['liked_at']
      }
    ]
  });

  return ArticleLike;
};

module.exports = ArticleLike;
