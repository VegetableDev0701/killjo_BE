const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Analytics extends Model {}

  Analytics.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    analyticsType: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'analytics_type'
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
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
    modelName: 'Analytics',
    tableName: 'analytics',
    timestamps: true,
    indexes: [
      {
        fields: ['analytics_type']
      }
    ]
  });

  return Analytics;
}; 