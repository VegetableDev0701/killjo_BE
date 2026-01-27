const { Op } = require('sequelize');
const { ClickConversion, Analytics, SearchQueryAnalytics } = require('../db');
const { extractKeywords } = require('./searchKeywordExtractor');

const AnalyticsType = {
    CLICK_CONVERSION_STATS: 'click_conversion_',
    TOP_SEARCH_STATS: 'top_searches_',
    TRENDING_CATEGORIES: 'trending_categories_',
    LOCATION_STATS: 'location_stats_'
};

class AnalyticsService {
    // Helper method to normalize date to start of day
    _normalizeDate(date) {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    }

    async logClickConversion(data) {
        try {
            const conversion = await ClickConversion.create({
                userId: data.userId,
                productId: data.productId,
                productType: data.productType,
                category: data.category,
                productOwnerId: data.productOwnerId
            });

            return conversion;
        } catch (error) {
            console.error('Error logging click conversion:', error);
            throw error;
        }
    }

    async updateClickConversionStats(daysArray) {
        for (const days of daysArray) {
            try {
                const stats = await this._calculateClickConversionStats(days);
                const analyticsType = `${AnalyticsType.CLICK_CONVERSION_STATS}${days}d`;
                await Analytics.upsert({
                    analyticsType: analyticsType,
                    data: stats
                });
            } catch (error) {
                console.error(`Error updating click conversion stats for ${days} days:`, error);
            }

        }
    }

    async getClickConversionsGroupData(startDate, endDate) {
        const stats = await ClickConversion.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                },
                category: {
                    [Op.ne]: 'products'
                }
            },
            attributes: [
                'category',
                [ClickConversion.sequelize.fn('COUNT', '*'), 'count']
            ],
            group: ['category'],
            order: [['count', 'DESC']]
        });

        return stats;
    }

    async _calculateClickConversionStats(days) {
        const endDate = this._normalizeDate(new Date());
        const startDate = this._normalizeDate(new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000)));
        const currentStats = await this.getClickConversionsGroupData(startDate, endDate);

        // Calculate previous period dates
        const previousEndDate = startDate;
        const previousStartDate = new Date(startDate.getTime() - (days * 24 * 60 * 60 * 1000));
        const previousStats = await this.getClickConversionsGroupData(previousStartDate, previousEndDate);

        // Create a map for previous period stats for easy lookup
        const previousStatsMap = new Map();
        previousStats.forEach(stat => {
            previousStatsMap.set(stat.category, stat.get('count'));
        });

        const trendingCategories = await this.getTrendingCategoryStats(days, true);
        const categoryViewCountMap = new Map();
        if (trendingCategories) {
            trendingCategories.forEach(cat => {
                categoryViewCountMap.set(cat.category, cat.searchCount);
            });
        }

        return currentStats.map(stat => {
            const currentCount = stat.get('count');
            const previousCount = previousStatsMap.get(stat.category) || 0;

            let percentageIncrease;
            if (previousCount > 0) {
                percentageIncrease = Math.round(((currentCount - previousCount) / previousCount) * 100);
            }

            const categoryViewCount = categoryViewCountMap.get(stat.category) || 0;

            return {
                category: stat.category,
                productType: 1,
                searchCount: categoryViewCount,
                clickCount: currentCount,
                percentageIncrease: percentageIncrease
            };
        });
    }

    async getClickConversionStats(days) {
        const analyticsType = `${AnalyticsType.CLICK_CONVERSION_STATS}${days}d`;
        const record = await Analytics.findOne({ where: { analyticsType } });
        if (record) {
            return record.data;
        } else {
            console.warn(`No analytics data found for type: ${analyticsType}`);
            return [];
        }
    }

    async logSearchQuery(rawQuery, searchResult, userLocation = {}) {
        const searchTerm = extractKeywords(rawQuery);
        const category = searchResult.category;
        const keysToRemove = ["general_names"];

        const filters = Object.fromEntries(
            Object.entries(searchResult.filters).filter(([key, value]) => {
                return !keysToRemove.includes(key) &&
                    value !== null &&
                    value !== "" &&
                    !(Array.isArray(value) && value.length === 0);
            })
        );

        try {
            await SearchQueryAnalytics.create({
                searchTerm,
                category,
                filters,
                userLocation
            });

        } catch (error) {
            console.error('Error logging unified search:', error);
            throw error;
        }
    }

    async updateTopSearchesStats(daysArray) {
        for (const days of daysArray) {
            try {
                const stats = await this._calculateTopSearchesStats(days);
                const analyticsType = `${AnalyticsType.TOP_SEARCH_STATS}${days}d`;
                await Analytics.upsert({
                    analyticsType: analyticsType,
                    data: stats
                });
            } catch (error) {
                console.error(`Error updating top search stats for ${days} days:`, error);
            }

        }
    }

    async getTopSearchGroupData(startDate, endDate, limit) {
        const stats = await SearchQueryAnalytics.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: [
                'searchTerm',
                [SearchQueryAnalytics.sequelize.fn('COUNT', '*'), 'count']
            ],
            group: ['searchTerm'],
            order: [['count', 'DESC']],
            limit: limit || 50
        });

        return stats;
    }

    async _calculateTopSearchesStats(days) {
        const endDate = this._normalizeDate(new Date());
        const startDate = this._normalizeDate(new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000)));
        const currentStats = await this.getTopSearchGroupData(startDate, endDate);

        // Calculate previous period dates
        const previousEndDate = startDate;
        const previousStartDate = new Date(startDate.getTime() - (days * 24 * 60 * 60 * 1000));
        const previousStats = await this.getTopSearchGroupData(previousStartDate, previousEndDate);

        // Create a map for previous period stats for easy lookup
        const previousStatsMap = new Map();
        previousStats.forEach(stat => {
            previousStatsMap.set(stat.searchTerm, stat.get('count'));
        });

        // Calculate percentage increase for each current stat
        return currentStats.map(stat => {
            const currentCount = stat.get('count');
            const previousCount = previousStatsMap.get(stat.searchTerm) || 0;

            let percentageIncrease;
            if (previousCount > 0) {
                percentageIncrease = Math.round(((currentCount - previousCount) / previousCount) * 100);
            }

            return {
                searchTerm: stat.searchTerm,
                searchCount: currentCount,
                percentageIncrease: percentageIncrease
            };
        });
    }

    async getTopSearchesStats(days) {
        const analyticsType = `${AnalyticsType.TOP_SEARCH_STATS}${days}d`;
        const record = await Analytics.findOne({ where: { analyticsType } });
        if (record) {
            return record.data;
        } else {
            console.warn(`No analytics data found for type: ${analyticsType}`);
            return [];
        }
    }

    async updateTrendingCategoryStats(daysArray) {
        for (const days of daysArray) {
            try {
                const stats = await this._calculateTrendingCategoryStats(days);
                const analyticsType = `${AnalyticsType.TRENDING_CATEGORIES}${days}d`;
                await Analytics.upsert({
                    analyticsType: analyticsType,
                    data: stats
                });
            } catch (error) {
                console.error(`Error updating trending categories stats for ${days} days:`, error);
            }

        }
    }

    async getTrendingCategoryGroupData(startDate, endDate) {
        const stats = await SearchQueryAnalytics.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: [
                'category',
                [SearchQueryAnalytics.sequelize.fn('COUNT', '*'), 'count']
            ],
            group: ['category'],
            order: [['count', 'DESC']]
        });

        return stats;
    }

    async _calculateTrendingCategoryStats(days) {
        const endDate = this._normalizeDate(new Date());
        const startDate = this._normalizeDate(new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000)));
        const currentStats = await this.getTrendingCategoryGroupData(startDate, endDate);

        // Calculate previous period dates
        const previousEndDate = startDate;
        const previousStartDate = new Date(startDate.getTime() - (days * 24 * 60 * 60 * 1000));
        const previousStats = await this.getTrendingCategoryGroupData(previousStartDate, previousEndDate);

        const getProductsSearchCount = (stats) => {
            let total = 0;
            for (const stat of stats) {
                if (!['vehicles', 'real_estate'].includes(stat.category)) {
                    total += parseInt(stat.get('count'));
                }
            }
            return total;
        }
        // Create a map for previous period stats for easy lookup
        const previousStatsMap = new Map();
        previousStats.forEach(stat => {
            previousStatsMap.set(stat.category, stat.get('count'));
        });

        previousStatsMap.set('products', getProductsSearchCount(previousStats));

        currentStats.push({
            category: 'products',
            count: getProductsSearchCount(currentStats)
        });

        // Calculate percentage increase for each current stat
        return currentStats.map(stat => {
            const currentCount = stat.get?.('count') ?? stat.count;
            const previousCount = previousStatsMap.get(stat.category) || 0;

            let percentageIncrease;
            if (previousCount > 0) {
                percentageIncrease = Math.round(((currentCount - previousCount) / previousCount) * 100);
            }

            return {
                category: stat.category,
                searchCount: currentCount,
                percentageIncrease: percentageIncrease
            };
        });
    }

    async getTrendingCategoryStats(days, keepProductsCategory = false) {
        const analyticsType = `${AnalyticsType.TRENDING_CATEGORIES}${days}d`;
        const record = await Analytics.findOne({ where: { analyticsType } });
        if (record) {
            if (keepProductsCategory) {
                return record.data;
            }
            // Filter out 'products' before returning, but keep it in storage
            return Array.isArray(record.data)
                ? record.data.filter(row => row.category !== 'products')
                : record.data;
        } else {
            console.warn(`No analytics data found for type: ${analyticsType}`);
            return [];
        }
    }

    async updateLocationStats(daysArray) {
        for (const days of daysArray) {
            try {
                const stats = await this._calculateLocationStats(days);
                const analyticsType = `${AnalyticsType.LOCATION_STATS}${days}d`;
                await Analytics.upsert({
                    analyticsType: analyticsType,
                    data: stats
                });
            } catch (error) {
                console.error(`Error updating location stats for ${days} days:`, error);
            }
        }
    }

    async getLocationGroupData(startDate, endDate) {
        // We need to group by the city inside the userLocation JSONB column
        // Note: 'userLocation' is the column name in Sequelize model, mapping to 'user_location' in DB
        // Using Sequelize JSON extraction syntax
        const stats = await SearchQueryAnalytics.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                },
                userLocation: {
                    [Op.ne]: null
                }
            },
            attributes: [
                [SearchQueryAnalytics.sequelize.literal(`"user_location"->>'city'`), 'city'],
                [SearchQueryAnalytics.sequelize.fn('COUNT', '*'), 'searchCount']
            ],
            group: [SearchQueryAnalytics.sequelize.literal(`"user_location"->>'city'`)],
            order: [[SearchQueryAnalytics.sequelize.fn('COUNT', '*'), 'DESC']]
        });

        // Filter out empty cities if any
        return stats.filter(stat => stat.get('city'));
    }

    async _calculateLocationStats(days) {
        const endDate = this._normalizeDate(new Date());
        const startDate = this._normalizeDate(new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000)));
        const currentStats = await this.getLocationGroupData(startDate, endDate);

        // Calculate previous period dates
        const previousEndDate = startDate;
        const previousStartDate = new Date(startDate.getTime() - (days * 24 * 60 * 60 * 1000));
        const previousStats = await this.getLocationGroupData(previousStartDate, previousEndDate);

        // Create a map for previous period stats
        const previousStatsMap = new Map();
        previousStats.forEach(stat => {
            previousStatsMap.set(stat.get('city'), parseInt(stat.get('searchCount')));
        });

        return currentStats.map(stat => {
            const city = stat.get('city');
            const currentCount = parseInt(stat.get('searchCount'));
            const previousCount = previousStatsMap.get(city) || 0;

            let percentageIncrease;
            if (previousCount > 0) {
                percentageIncrease = Math.round(((currentCount - previousCount) / previousCount) * 100);
            }

            return {
                city,
                searchCount: currentCount,
                percentageIncrease
            };
        });
    }

    async getLocationStats(days) {
        const analyticsType = `${AnalyticsType.LOCATION_STATS}${days}d`;
        const record = await Analytics.findOne({ where: { analyticsType } });
        if (record) {
            return record.data;
        } else {
            // Return empty array instead of throwing if data not ready yet, consistent with expectations
            // or throw if strict. Let's return empty array or null to avoid crashing UI
            console.warn(`No analytics data found for type: ${analyticsType}`);
            return [];
        }
    }
}

module.exports = new AnalyticsService();
