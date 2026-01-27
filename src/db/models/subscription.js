const { DataTypes } = require('sequelize');

const Subscription = (sequelize) => {
  const SubscriptionModel = sequelize.define('Subscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'transaction_id'
  },
  originalTransactionId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'original_transaction_id'
  },
  paymentType: {
    type: DataTypes.ENUM('subscription', 'in_app_purchase'),
    allowNull: false,
    field: 'payment_type'
  },
  productId: {
    type: DataTypes.STRING,
    allowNull: true, // Can be null for some product types
    field: 'product_id'
  },
  productType: {
    type: DataTypes.ENUM('monthly_subscription', 'yearly_subscription', 'boost', 'profile_verification', 'merchant_boost'),
    allowNull: false,
    field: 'product_type'
  },
  duration: {
    type: DataTypes.ENUM('monthly', 'yearly', 'weekly', 'lifetime'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD'
  },
  purchaseDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'purchase_date'
  },
  expiresDate: {
    type: DataTypes.DATE,
    allowNull: true, // Null for lifetime or one-time purchases
    field: 'expires_date'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  autoRenewStatus: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'auto_renew_status'
  },
  environment: {
    type: DataTypes.ENUM('Sandbox', 'Production'),
    allowNull: false,
    defaultValue: 'Sandbox'
  },
  platform: {
    type: DataTypes.ENUM('ios', 'android'),
    allowNull: false,
    defaultValue: 'ios'
  },
  // Store the raw Apple transaction data
  appleTransactionData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'apple_transaction_data'
  },
  // Store the raw Google Play transaction data
  googlePlayTransactionData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'google_play_transaction_data'
  },
  // Store original frontend payload
  frontendPayload: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'frontend_payload'
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'expired', 'cancelled', 'refunded'),
    defaultValue: 'pending'
  },
  // For tracking renewal history
  renewalCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'renewal_count'
  },
  lastRenewalDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_renewal_date'
  }
}, {
  tableName: 'subscriptions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id', 'is_active']
    },
    {
      fields: ['transaction_id']
    },
    {
      fields: ['original_transaction_id']
    },
    {
      fields: ['expires_date']
    },
    {
      fields: ['product_type', 'is_active']
    },
    {
      fields: ['user_id', 'product_type', 'is_active']
    }
  ]
  });

  return SubscriptionModel;
};

module.exports = Subscription;