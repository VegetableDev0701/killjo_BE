const { Model, DataTypes } = require('sequelize');

const User = (sequelize) => {
  class User extends Model {
    static associate(models) {
      // Define associations if needed
    }
  }

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    apple_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    google_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'full_name'
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_email_verified'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'inactive', 'suspended']]
      }
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refresh_token: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'refresh_token'
    },
    refresh_token_expires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'refresh_token_expires'
    },
    favorites: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      get() {
        const rawValue = this.getDataValue('favorites');
        return rawValue || [];
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    verifiedStatus: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['UNPAID', 'PAID', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED']]
      },
      defaultValue: 'PAID'
    },
    analyticsAccessStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['NO_ACCESS', 'APPROVED', 'UNDER_REVIEW', 'REJECTED']]
      },
      defaultValue: 'NO_ACCESS',
      field: 'analytics_access_status'
    },
    analyticsAccessExpire: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'analytics_access_expire'
    },
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    paranoid: true,
    timestamps: true
  });

  return User;
};

module.exports = User; 