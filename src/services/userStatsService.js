const redisService = require('./redisService');
const { User } = require('../db');

class UserStatsService {
  constructor() {
    this.CACHE_KEY = 'user_stats:total_registered';
    this.CACHE_EXPIRY = 3000000; // 5 minutes
  }

  /**
   * Get total registered users count with Redis caching
   * @returns {Promise<number>} Total count of registered users
   */
  async getTotalRegisteredUsers() {
    try {
      // Try to get from cache first
      const cachedCount = await redisService.client.get(this.CACHE_KEY);
      
      if (cachedCount !== null) {
        console.log('Returning user count from cache:', cachedCount);
        return parseInt(cachedCount, 10);
      }

      // If not in cache, query database
      console.log('Cache miss, querying database for user count');
      const count = await User.count({
        where: {
          status: 'active' // Only count active users
        }
      });

      // Cache the result
      await redisService.client.setex(this.CACHE_KEY, this.CACHE_EXPIRY, count.toString());
      
      console.log('User count cached:', count);
      return count;
    } catch (error) {
      console.error('Error getting total registered users:', error);
      
      // Fallback to database query if Redis fails
      try {
        const count = await User.count({
          where: {
            status: 'active'
          }
        });
        return count;
      } catch (dbError) {
        console.error('Database fallback also failed:', dbError);
        throw new Error('Unable to retrieve user count');
      }
    }
  }

  /**
   * Invalidate the user count cache
   * This should be called when a new user registers or user status changes
   */
  async invalidateUserCountCache() {
    try {
      await redisService.client.del(this.CACHE_KEY);
      console.log('User count cache invalidated');
      return true;
    } catch (error) {
      console.error('Error invalidating user count cache:', error);
      return false;
    }
  }

  /**
   * Update user count cache with new value
   * @param {number} count - New count to cache
   */
  async updateUserCountCache(count) {
    try {
      await redisService.client.setex(this.CACHE_KEY, this.CACHE_EXPIRY, count.toString());
      console.log('User count cache updated with:', count);
      return true;
    } catch (error) {
      console.error('Error updating user count cache:', error);
      return false;
    }
  }

  /**
   * Get user statistics including breakdown by status
   * @returns {Promise<Object>} User statistics object
   */
  async getUserStatistics() {
    try {
      const cacheKey = 'user_stats:detailed';
      const cachedStats = await redisService.client.get(cacheKey);
      
      if (cachedStats !== null) {
        return JSON.parse(cachedStats);
      }

      // Query for detailed statistics
      const [totalActive, totalInactive, totalDeleted, totalUsers] = await Promise.all([
        User.count({ where: { status: 'active' } }),
        User.count({ where: { status: 'inactive' } }),
        User.count({ where: { status: 'suspended' } }),
        User.count()
      ]);

      const stats = {
        total: totalUsers,
        active: totalActive,
        inactive: totalInactive,
        suspended: totalSuspended,
        timestamp: new Date().toISOString()
      };

      // Cache for 5 minutes
      await redisService.client.setex(cacheKey, this.CACHE_EXPIRY, JSON.stringify(stats));
      
      return stats;
    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw new Error('Unable to retrieve user statistics');
    }
  }
}

module.exports = new UserStatsService();