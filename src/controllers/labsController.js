const { Article, ArticleView, ArticleLike, sequelize } = require('../db');
const { Op } = require('sequelize');

class LabsController {
  /**
   * Get bulk article stats
   * POST /labs/articles
   * Body: { articleIds: string[] }
   */
  async getBulkArticleStats(req, res) {
    try {
      const { articleIds } = req.body;
      const userId = req.user?.id || null;
      const deviceId = req.headers['x-device-id'] || req.ip;

      // Validation
      if (!articleIds || !Array.isArray(articleIds)) {
        return res.status(400).json({
          success: false,
          error: 'articleIds must be an array'
        });
      }

      // Limit to prevent abuse
      if (articleIds.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 100 article IDs allowed'
        });
      }

      // Fetch all articles with their counts
      // Create articles on-the-fly if they don't exist (upsert pattern)
      const articles = await Promise.all(
        articleIds.map(async (articleId) => {
          const [article] = await Article.findOrCreate({
            where: { id: articleId },
            defaults: {
              id: articleId,
              viewCount: 0,
              likeCount: 0
            }
          });
          return article;
        })
      );

      // Check which articles the user has liked
      const likeQuery = {
        articleId: { [Op.in]: articleIds }
      };

      if (userId) {
        likeQuery.userId = userId;
      } else {
        likeQuery.deviceId = deviceId;
        likeQuery.userId = null;
      }

      const likes = await ArticleLike.findAll({
        where: likeQuery,
        attributes: ['articleId']
      });

      const likedArticleIds = new Set(likes.map(like => like.articleId));

      // Build stats response
      const stats = articles.map(article => ({
        id: article.id,
        viewCount: article.viewCount || 0,
        likeCount: article.likeCount || 0,
        hasLiked: likedArticleIds.has(article.id)
      }));

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Error fetching bulk article stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch article stats'
      });
    }
  }

  /**
   * Record article view
   * POST /labs/articles/:id/view
   */
  async recordArticleView(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const deviceId = req.headers['x-device-id'] || req.ip;
      const ipAddress = req.ip;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Article ID is required'
        });
      }

      // Use a transaction to ensure consistency
      const result = await sequelize.transaction(async (t) => {
        // Check if view already exists
        const viewQuery = {
          articleId: id
        };

        if (userId) {
          viewQuery.userId = userId;
        } else {
          viewQuery.deviceId = deviceId;
          viewQuery.userId = null;
        }

        const existingView = await ArticleView.findOne({
          where: viewQuery,
          transaction: t
        });

        let article;

        if (!existingView) {
          // Record new view
          await ArticleView.create({
            articleId: id,
            userId,
            deviceId,
            ipAddress,
            viewedAt: new Date()
          }, { transaction: t });

          // Find or create article and increment view count
          const [articleRecord, created] = await Article.findOrCreate({
            where: { id },
            defaults: {
              id,
              viewCount: 1,
              likeCount: 0
            },
            transaction: t
          });

          if (!created) {
            // Article exists, increment view count
            await articleRecord.increment('viewCount', { by: 1, transaction: t });
            await articleRecord.reload({ transaction: t });
          }

          article = articleRecord;
        } else {
          // View already exists, just fetch the article
          article = await Article.findByPk(id, { transaction: t });
          
          if (!article) {
            // Create article if it doesn't exist
            article = await Article.create({
              id,
              viewCount: 0,
              likeCount: 0
            }, { transaction: t });
          }
        }

        return article;
      });

      res.json({
        success: true,
        viewCount: result.viewCount
      });
    } catch (error) {
      console.error('Error recording article view:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record article view'
      });
    }
  }

  /**
   * Toggle article like
   * POST /labs/articles/:id/like
   */
  async toggleArticleLike(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const deviceId = req.headers['x-device-id'] || req.ip;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Article ID is required'
        });
      }

      // Use a transaction to ensure consistency
      const result = await sequelize.transaction(async (t) => {
        // Check if like already exists
        const likeQuery = {
          articleId: id
        };

        if (userId) {
          likeQuery.userId = userId;
        } else {
          likeQuery.deviceId = deviceId;
          likeQuery.userId = null;
        }

        const existingLike = await ArticleLike.findOne({
          where: likeQuery,
          transaction: t
        });

        let hasLiked;
        let article;

        if (existingLike) {
          // Unlike - delete the like
          await existingLike.destroy({ transaction: t });

          // Find or create article and decrement like count
          const [articleRecord] = await Article.findOrCreate({
            where: { id },
            defaults: {
              id,
              viewCount: 0,
              likeCount: 0
            },
            transaction: t
          });

          // Decrement like count, but don't go below 0
          if (articleRecord.likeCount > 0) {
            await articleRecord.decrement('likeCount', { by: 1, transaction: t });
          }
          await articleRecord.reload({ transaction: t });

          hasLiked = false;
          article = articleRecord;
        } else {
          // Like - create the like
          await ArticleLike.create({
            articleId: id,
            userId,
            deviceId,
            likedAt: new Date()
          }, { transaction: t });

          // Find or create article and increment like count
          const [articleRecord, created] = await Article.findOrCreate({
            where: { id },
            defaults: {
              id,
              viewCount: 0,
              likeCount: 1
            },
            transaction: t
          });

          if (!created) {
            await articleRecord.increment('likeCount', { by: 1, transaction: t });
            await articleRecord.reload({ transaction: t });
          }

          hasLiked = true;
          article = articleRecord;
        }

        return { hasLiked, article };
      });

      res.json({
        success: true,
        hasLiked: result.hasLiked,
        likeCount: result.article.likeCount
      });
    } catch (error) {
      console.error('Error toggling article like:', error);
      
      // Handle unique constraint violations gracefully
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          error: 'Like operation conflict. Please try again.'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to toggle article like'
      });
    }
  }
}

module.exports = new LabsController();
