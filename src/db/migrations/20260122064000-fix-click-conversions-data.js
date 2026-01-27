'use strict';

const { DataTypes } = require('sequelize');
const ScrappedDataService = require('../../services/scrappedDataService');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const logger = console; // Use console or a compatible logger

        try {
            logger.log('Starting data fix for ClickConversions (productType=2)...');

            // Define minimal models for this migration to ensure independence from app models
            const Merchant = queryInterface.sequelize.define('Merchant', {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                user_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                },
                brand_name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
            }, {
                tableName: 'merchant',
                timestamps: false
            });

            const ClickConversion = queryInterface.sequelize.define('ClickConversion', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
                productId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    field: 'product_id'
                },
                productType: {
                    type: DataTypes.SMALLINT,
                    allowNull: false,
                    field: 'product_type'
                },
                category: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                productOwnerId: {
                    type: DataTypes.UUID,
                    allowNull: true,
                    field: 'product_owner_id'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                    field: 'created_at'
                }
            }, {
                tableName: 'click_conversions',
                timestamps: true
            });

            // Fetch merchants for mapping (fetch once as it's likely manageable size)
            logger.log('Fetching merchants...');
            const merchants = await Merchant.findAll({
                attributes: ['user_id', 'brand_name']
            });
            logger.log(`Fetched ${merchants.length} merchants.`);

            // Create a map of brand_name -> user_id (normalized for better matching)
            const brandMap = {};
            merchants.forEach(m => {
                if (m.brand_name) {
                    brandMap[m.brand_name.toLowerCase().trim()] = m.user_id;
                }
            });

            // Batch processing settings for scalability
            const BATCH_SIZE = 1000;
            let lastId = 0;
            let processedCount = 0;
            let updatedCount = 0;
            let hasMore = true;

            logger.log('Starting batch processing...');

            while (hasMore) {
                // Fetch batch using cursor pagination (more efficient than offset for large datasets)
                const conversions = await ClickConversion.findAll({
                    where: {
                        productType: 2,
                        id: { [Sequelize.Op.gt]: lastId }
                    },
                    order: [['id', 'ASC']],
                    limit: BATCH_SIZE
                });

                if (conversions.length === 0) {
                    hasMore = false;
                    break;
                }

                // Update cursor for next iteration
                lastId = conversions[conversions.length - 1].id;
                processedCount += conversions.length;

                // Extract unique product IDs for this batch
                const productIds = [...new Set(conversions.map(c => c.productId))];

                // Fetch scrapped data for this batch
                let scrappedData = [];
                if (productIds.length > 0) {
                    try {
                        scrappedData = await ScrappedDataService.getScrappedDataByProductIds(productIds);
                    } catch (err) {
                        logger.error('Error fetching scrapped data batch:', err);
                        throw err;
                    }
                }

                // Create map for this batch
                const productsMap = {};
                scrappedData.forEach(p => {
                    productsMap[p.hid] = p;
                });

                // Prepare updates for parallel execution
                const updatePromises = [];

                for (const conversion of conversions) {
                    const product = productsMap[conversion.productId];
                    let needsUpdate = false;
                    const updates = {};

                    if (product) {
                        // Update category if it differs
                        if (product.category && conversion.category !== product.category) {
                            updates.category = product.category;
                            needsUpdate = true;
                        }

                        // Update productOwnerId based on source -> brand_name mapping
                        if (product.source) {
                            const sourceNormalized = product.source.toLowerCase().trim();
                            const ownerId = brandMap[sourceNormalized];

                            if (ownerId && conversion.productOwnerId !== ownerId) {
                                updates.productOwnerId = ownerId;
                                needsUpdate = true;
                            }
                        }
                    }

                    if (needsUpdate) {
                        updatePromises.push(conversion.update(updates));
                        updatedCount++;
                    }
                }

                // Execute all updates for this batch in parallel
                if (updatePromises.length > 0) {
                    await Promise.all(updatePromises);
                }

                logger.log(`Processed ${processedCount} records. Updated ${updatedCount} so far...`);
            }

            logger.log(`Finished! Processed ${processedCount} total records, updated ${updatedCount} conversions.`);

        } catch (error) {
            logger.error('Migration failed:', error);
            throw error;
        } finally {
            // Clean up the pool connection from ScrappedDataService if it exists
            if (ScrappedDataService.pool && typeof ScrappedDataService.pool.end === 'function') {
                try {
                    logger.log('Closing ScrappedDataService pool connection...');
                    await ScrappedDataService.pool.end();
                    logger.log('Pool connection closed successfully.');
                } catch (e) {
                    logger.warn('Error closing pool connection:', e.message);
                }
            }
        }
    },

    async down(queryInterface, Sequelize) {
        // Irreversible data fix
        console.log('Down migration for data fix is not implemented (irreversible).');
    }
};
