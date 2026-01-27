const { Model, DataTypes } = require('sequelize');

const ArticleView = (sequelize) => {
  class ArticleView extends Model { }

  ArticleView.init({
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
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'ip_address',
      comment: 'IP address for fraud detection'
    },
    viewedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'viewed_at'
    }
  }, {
    sequelize,
    modelName: 'ArticleView',
    tableName: 'article_views',
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ['article_id', 'user_id']
      },
      {
        fields: ['article_id', 'device_id']
      },
      {
        fields: ['article_id']
      },
      {
        fields: ['viewed_at']
      }
    ]
  });

  return ArticleView;
};

module.exports = ArticleView;
