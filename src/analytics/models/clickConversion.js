const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ClickConversion extends Model { }

  ClickConversion.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'product_id'
    },
    productType: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      field: 'product_type'
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false
    },
    productOwnerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'product_owner_id'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    sequelize,
    modelName: 'ClickConversion',
    tableName: 'click_conversions',
    timestamps: true,
    indexes: [
      {
        fields: ['product_id']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['category']
      }
    ]
  });

  return ClickConversion;
}; 