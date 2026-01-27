'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('search_queries', 'user_location', {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: {}
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('search_queries', 'user_location');
    }
};
