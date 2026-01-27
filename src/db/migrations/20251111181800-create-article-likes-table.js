'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('article_likes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      article_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'articles',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      device_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      liked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('article_likes', ['article_id']);
    await queryInterface.addIndex('article_likes', ['liked_at']);
    
    // Add partial unique indexes for preventing duplicate likes
    // Note: PostgreSQL partial indexes need to be created with raw SQL
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX article_likes_article_user_unique 
      ON article_likes (article_id, user_id) 
      WHERE user_id IS NOT NULL;
    `);
    
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX article_likes_article_device_unique 
      ON article_likes (article_id, device_id) 
      WHERE user_id IS NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('article_likes');
  }
};
