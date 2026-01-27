const cron = require('node-cron');
const { Merchant } = require('../config/database');
const listing = require('../models/Listing');
const logger = require('../utils/logger');
const { Op } = require('sequelize'); // Destructure Op for cleaner code

/**
 * Expires boosts for Merchants where boost_expire date has passed
 * and boost_expire is not NULL.
 */
const expireMerchantBoosts = async () => {
  try {
    const now = new Date();
    
    // Requirement: boost = 1 is actively boosted. boost = 0 is expired.
    const result = await Merchant.update(
      { boost: 0 }, // Set to 0 to expire it
      {
        where: {
          // 1. The expiration date must NOT be NULL
          boost_expire: {
            [Op.not]: null,
            // 2. The expiration date is less than or equal to right now (it's in the past)
            [Op.lte]: now 
          },
          // 3. Only try to expire rows that are currently actively boosted (boost = 1)
          boost: 1 
        }
      }
    );
    
    // ... rest of the function remains the same ...
    if (result[0] > 0) {
      logger.info(`Expired boosts for ${result[0]} merchants`);
    }
    
    return result[0];
  } catch (error) {
    logger.error('Error expiring merchant boosts:', error);
    throw error;
  }
};


/**
 * Expires boosts for Listings where boost_expire date has passed
 * and boost_expire is not NULL.
 */
const expireListingBoosts = async () => {
  try {
    // Use ISO string for raw PostgreSQL timestamp comparison
    const now = new Date().toISOString();

    // Requirement: Set boost to 0 WHERE it is currently 1 AND the date has passed AND the date is NOT NULL
    const updateSQL = `
      UPDATE ${listing.tableName}
      SET boost = 0
      WHERE boost_expire <= $1
        AND boost = 1
        AND boost_expire IS NOT NULL
      RETURNING id
    `;
    
    const result = await listing.pool.query(updateSQL, [now]);
    
    // ... rest of the function remains the same ...
    if (result.rowCount > 0) {
      logger.info(`Expired boosts for ${result.rowCount} listings`);
    }
    
    return result.rowCount;
  } catch (error) {
    logger.error('Error expiring listing boosts:', error);
    throw error;
  }
};

/**
 * Main function to expire boosts for both Merchants and Listings
 */
const expireBoosts = async () => {
  try {
    // Add a timestamp to the log so you know exactly when it ran
    logger.info(`[${new Date().toISOString()}] Starting boost expiration check...`);
    
    const [merchantCount, listingCount] = await Promise.all([
      expireMerchantBoosts(),
      expireListingBoosts()
    ]);
    
    logger.info(`Boost expiration completed: ${merchantCount} merchants, ${listingCount} listings modified.`);
  } catch (error) {
    logger.error('Error in boost expiration job:', error);
  }
};

/**
 * Schedule the boost expiration job to run every minute
 */
const scheduleBoostExpiration = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    await expireBoosts();
  });
  
  logger.info('⏰ Boost expiration cron job scheduled (runs daily at 00:00)');
  
  // // Recommended for debugging: Uncomment this briefly to test if it works immediately upon server restart.
  // (async () => {
  //   logger.info('🚀 Testing boost expiration immediately on startup');
  //   await expireBoosts();
  // })();
};

module.exports = { scheduleBoostExpiration, expireBoosts };
