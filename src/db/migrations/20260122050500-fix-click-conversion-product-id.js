'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Change product_id column type from UUID to STRING to support mixed formats
        // We use VARCHAR(255) to be safe for various ID lengths (UUIDs are 36 chars)
        await queryInterface.changeColumn('click_conversions', 'product_id', {
            type: Sequelize.STRING,
            allowNull: false
        });

        // 2. For productType 2, the IDs should be without dashes. 
        // They were converted to dashed UUIDs by the database/Sequelize previously.
        // We strip the dashes to restore them to their original format.
        await queryInterface.sequelize.query(
            `UPDATE "click_conversions" 
       SET "product_id" = REPLACE("product_id", '-', '') 
       WHERE "product_type" = 2`
        );
    },

    async down(queryInterface, Sequelize) {
        // NOTE: This down migration attempts to convert back to UUID column type.
        // This will implicitly format valid UUID strings back to dashed UUIDs in Postgres.
        // However, if strict non-UUID strings were stored that cannot be cast to UUID, this might fail.
        // Given the user's context (Type 2 is non-dashed UUID hex), Postgres UUID type CAN accept 
        // hex strings without dashes (32 chars) and will store them as UUIDs (formatting them with dashes on reading).
        // So this reversal essentially "re-corrupts" the Type 2 IDs back to dashed format as originally described by the user.

        await queryInterface.changeColumn('click_conversions', 'product_id', {
            type: Sequelize.UUID,
            allowNull: false,
            // 'USING' clause is implicit for string->uuid if format is valid
        });
    }
};
