'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('merchant', 'status', {
      type: Sequelize.ENUM('active', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    });

    // Update existing records to 'active' status
    await queryInterface.sequelize.query(
      "UPDATE merchant SET status = 'active' WHERE status IS NULL"
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('merchant', 'status');
    
    // Drop the ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_merchant_status"');
  }
};
