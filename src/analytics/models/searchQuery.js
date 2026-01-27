const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SearchQuery extends Model { }

  SearchQuery.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    searchTerm: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'search_term'
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filters: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    userLocation: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'user_location',
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    sequelize,
    modelName: 'SearchQuery',
    tableName: 'search_queries',
    timestamps: true,
    indexes: [
      {
        fields: ['search_term']
      },
      {
        fields: ['category']
      }
    ]
  });

  return SearchQuery;
}; 