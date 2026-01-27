'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('merchant', 'boost_expire', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when merchant boost expires'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('merchant', 'boost_expire');
  }
};
