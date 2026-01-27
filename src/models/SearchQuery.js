const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const SearchQuery = sequelize.define('SearchQuery', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  searchId: {
    type: DataTypes.STRING(8),
    unique: true,
    allowNull: false,
    field: 'search_id',
    comment: 'Unique 8-character search ID'
  },
  originalQuery: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'original_query',
    comment: 'Original user query'
  },
  vectorQuery: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'vector_query',
    comment: 'AI-optimized vector query'
  },
  vectorQueryListing: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'vector_query_listing',
    comment: 'AI-optimized vector query for listing'
  },
  category: {
    type:  DataTypes.STRING(50),
    allowNull: false,
    comment: 'Detected category'
  },
  filters: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Applied filters (brand, color, price, etc.)'
  },
  totalResults: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'total_results',
    comment: 'Total number of results found'
  },
  totalListingResults: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'total_listing_results',
    comment: 'Total number of listing results found'
  },
  searchMethod: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'vector_simple',
    field: 'search_method',
    comment: 'Search method used'
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 1.0,
    comment: 'Search confidence score'
  },
  language: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'en',
    comment: 'Detected language'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional search metadata'
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
  tableName: 'search_queries',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['search_id']
    },
    {
      fields: ['category']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = SearchQuery; 