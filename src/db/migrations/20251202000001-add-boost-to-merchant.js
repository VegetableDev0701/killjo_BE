'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('merchant', 'boost', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Boost score for merchant (similar to listing boost)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('merchant', 'boost');
  }
};
