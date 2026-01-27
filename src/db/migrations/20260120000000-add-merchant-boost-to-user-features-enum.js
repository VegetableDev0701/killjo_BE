'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add merchant_boost to the user_features feature_type enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_user_features_feature_type" 
      ADD VALUE IF NOT EXISTS 'merchant_boost';
    `);

    console.log('merchant_boost added to user_features feature_type enum');
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values easily
    // If you need to remove 'merchant_boost', you'd need to recreate the enum type
    console.log('Note: PostgreSQL does not support removing enum values. Manual intervention required if rollback is needed.');
  }
};
