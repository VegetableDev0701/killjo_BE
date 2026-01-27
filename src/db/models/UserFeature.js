const { DataTypes } = require('sequelize');

const UserFeature = (sequelize) => {
  const UserFeatureModel = sequelize.define('UserFeature', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'user_id'
  },
  featureType: {
    type: DataTypes.ENUM('boost', 'profile_verification', 'premium_subscription', 'merchant_boost'),
    allowNull: false,
    field: 'feature_type'
  },
  subscriptionId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'subscription_id',
    references: {
      model: 'subscriptions',
      key: 'id'
    }
    
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  activatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'activated_at'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  },
}, {
  tableName: 'user_features',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id', 'feature_type', 'is_active']
    }
  ]
  });

  return UserFeatureModel;
};

module.exports = UserFeature;