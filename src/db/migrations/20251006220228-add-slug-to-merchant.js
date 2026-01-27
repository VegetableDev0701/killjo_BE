'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get only merchants with null slugs
    const [merchants] = await queryInterface.sequelize.query(
      'SELECT id, brand_name FROM merchant WHERE slug IS NULL'
    );

    for (const merchant of merchants) {      
      // Basic slugify function
      let baseSlug = merchant.brand_name
        .toLowerCase()
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Ensure uniqueness
      let numberSuffix = 0;
      let slug;

      while (true) {
        slug = numberSuffix > 0 ? `${baseSlug}-${numberSuffix}` : baseSlug;
        const [rows] = await queryInterface.sequelize.query(
          `SELECT 1 FROM merchant WHERE slug = '${slug}'`
        );
        
        if (rows.length === 0) break;
        numberSuffix++;
      }

      await queryInterface.sequelize.query(
        `UPDATE merchant SET slug = '${slug}' WHERE id = '${merchant.id}'`
      );
    }

  },

  async down(queryInterface, Sequelize) {
    // Since we're only adding slugs to null fields, 
    // down migration will just set those slugs back to null
    await queryInterface.sequelize.query(
      'UPDATE merchant SET slug = NULL WHERE id IN (SELECT id FROM merchant WHERE slug IS NOT NULL)',
      { type: Sequelize.QueryTypes.UPDATE }
    );
  },
};
