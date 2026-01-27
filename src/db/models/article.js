const { Model, DataTypes } = require('sequelize');

const Article = (sequelize) => {
  class Article extends Model { }

  Article.init({
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      comment: 'Article ID from GitHub JSON files'
    },
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'view_count',
      validate: {
        min: 0
      }
    },
    likeCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'like_count',
      validate: {
        min: 0
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional metadata for the article'
    }
  }, {
    sequelize,
    modelName: 'Article',
    tableName: 'articles',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['view_count']
      },
      {
        fields: ['like_count']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Article;
};

module.exports = Article;
