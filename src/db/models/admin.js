const { Model, DataTypes } = require('sequelize');

const Admin = (sequelize) => {
  class Admin extends Model {
    static associate(models) {
      // Define associations if needed
    }
  }

  Admin.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password_hash'
    },
    sessionToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'session_token'
    },
    jwtToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'jwt_token'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    sequelize,
    modelName: 'Admin',
    tableName: 'admins',
    underscored: true,
    paranoid: true,
    timestamps: true
  });

  return Admin;
};

module.exports = Admin;
