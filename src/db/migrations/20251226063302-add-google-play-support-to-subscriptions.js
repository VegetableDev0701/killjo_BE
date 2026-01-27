'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add google_play_transaction_data column to subscriptions table
    await queryInterface.addColumn('subscriptions', 'google_play_transaction_data', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Stores raw Google Play purchase/subscription data'
    });

    // Update product_type enum to add merchant_boost
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_subscriptions_product_type" 
      ADD VALUE IF NOT EXISTS 'merchant_boost';
    `);

    console.log('Google Play support added to subscriptions table');
  },

  async down(queryInterface, Sequelize) {
    // Remove google_play_transaction_data column
    await queryInterface.removeColumn('subscriptions', 'google_play_transaction_data');

    // Note: PostgreSQL doesn't support removing enum values easily
    // If you need to remove 'merchant_boost', you'd need to recreate the enum type
    console.log('Google Play support removed from subscriptions table');
  }
};
