'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add index for better performance on google_id lookups
    await queryInterface.addIndex('users', ['google_id'], {
      name: 'users_google_id_idx',
      unique: true
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('users', 'users_google_id_idx');
  }
};
