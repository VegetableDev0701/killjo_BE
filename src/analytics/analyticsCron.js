const cron = require('node-cron');
const analyticsService = require('./analyticsService');
const logger = require('../utils/logger');
const Category = require('../models/Category');
const reportGenerator = require('./reports/reportGenerator');
const minioService = require('../services/minioService');
const aiInsightsService = require('./aiInsightsService');

// Helper for retries
async function withRetry(fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      logger.warn(`Retrying operation (${i + 1}/${retries})...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

async function generateAndUploadReport(period, language) {
  try {
    // 1. Fetch Analytics Data
    // We get stats for the last 'period' days.
    // Assuming analyticsService methods return data suitable for the report.
    const [trending, topSearches, clicks, locationStats] = await Promise.all([
      analyticsService.getTrendingCategoryStats(period),
      analyticsService.getTopSearchesStats(period),
      analyticsService.getClickConversionStats(period),
      analyticsService.getLocationStats(period)
    ]);

    // 2. Generate AI Insights
    const aiInsights = await withRetry(() => aiInsightsService.generateInsights({
      trending: trending.slice(0, 10), // Send only top 10 to save tokens
      topSearches: topSearches.slice(0, 10),
      clicks: clicks.slice(0, 10),
      locationStats: locationStats.slice(0, 10)
    }, period, language));

    // 3. Generate PDF
    const pdfBuffer = await reportGenerator.generateReportPdf(
      trending,
      topSearches,
      clicks,
      locationStats,
      `${period} days`, // simple label, can be dynamic date range
      language,
      aiInsights
    );

    // 4. Upload to MinIO
    const fileName = `analytics-report-${period}days-${language === 'en' ? 'english' : 'spanish'}.pdf`;
    await withRetry(() => minioService.uploadFile(pdfBuffer, fileName, 'application/pdf', 'reports'));

    logger.info(`Successfully generated and uploaded report: ${fileName}`);
  } catch (error) {
    logger.error(`Failed to generate report for ${period} days (${language}):`, error);
    // We log but don't throw to prevent stopping other reports
  }
}

const scheduleAnalyticsUpdate = () => {

  cron.schedule('1 0 * * *', async () => {
    try {
      logger.info('Starting daily analytics update');
      await analyticsService.updateTrendingCategoryStats([7, 30]);
      await analyticsService.updateTopSearchesStats([7, 30]);
      await analyticsService.updateClickConversionStats([7, 30]);
      await analyticsService.updateLocationStats([7, 30]);

      // Generate Reports
      logger.info('Starting daily report generation');
      const periods = [7, 30];
      const languages = ['en', 'es'];

      for (const period of periods) {
        for (const lang of languages) {
          await generateAndUploadReport(period, lang);
        }
      }

      logger.info('Completed daily analytics update and reporting');
    } catch (error) {
      logger.error('Error in daily analytics update:', error);
    }
  });

  // Run on startup dev/test convenience (optional, usually commented out in prod but good for testing now)

  (async () => {
    logger.info('🚀 Starting analytics update on startup');
    try {
      // await analyticsService.updateTrendingCategoryStats([7,30]);
      // await analyticsService.updateTopSearchesStats([7,30]);
      // await analyticsService.updateClickConversionStats([7, 30]);

      // Generate reports on startup too for verification?
      logger.info('Starting daily report generation');
      const periods = [7, 30];
      const languages = ['en', 'es'];

      for (const period of periods) {
        for (const lang of languages) {
          await generateAndUploadReport(period, lang);
        }
      }

      logger.info('Completed analytics update on startup');
    } catch (error) {
      logger.error('Error in analytics update on startup:', error);
    }
  })();


  (async () => {
    await Category.updateCategoriesDatabase();
  })();
};

module.exports = { scheduleAnalyticsUpdate };