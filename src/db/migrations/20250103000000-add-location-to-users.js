'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('users', 'location', {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: {}
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('users', 'location');
    }
};
