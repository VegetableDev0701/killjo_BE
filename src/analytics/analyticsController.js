const analyticsService = require('./analyticsService');

const aiInsightsService = require('./aiInsightsService');
const reportGenerator = require('./reports/reportGenerator');
const minioService = require('../services/minioService');
const { User } = require('../db');
class AnalyticsController {
    async downloadReport(req, res) {
        try {
            const user = await User.findOne({
                where: {
                    id: req.user.id,
                    status: 'active'
                }
            });

            if (user?.analyticsAccessStatus !== 'APPROVED') {
                return res.status(403).json({ error: 'Access denied. Analytics access not approved.' });
            }
            const period = parseInt(req.query.period) || 7;
            const validPeriods = [7, 30];
            if (!validPeriods.includes(period)) {
                return res.status(400).json({ error: 'Invalid period. Use 7 or 30.' });
            }

            const language = (user.metadata.country === 'DO') ? 'es' : 'en';

            const fileName = `analytics-report-${period}days-${language === 'en' ? 'english' : 'spanish'}.pdf`;
            const objectKey = `reports/${fileName}`;

            // Check if file exists and get presigned URL
            try {
                // We use getPresignedUrl to let the client download it directly from MinIO/S3
                const url = await minioService.getPresignedUrl(objectKey, 3600); // 1 hour expiry
                res.json({ downloadUrl: url });
            } catch (storageError) {
                // If file doesn't exist, we could arguably generate one on the fly, 
                // but for now we'll return 404 as the cron should have run.
                console.error("Report not found:", storageError);
                return res.status(404).json({ error: 'Report not available. Please try again later.' });
            }

        } catch (error) {
            console.error('Error downloading report:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async trackClickConversion(req, res) {
        try {
            const conversionData = {
                userId: req.user?.id, // from auth middleware
                productId: req.body.productId,
                productType: req.body.productType,
                category: req.body.category,
                productOwnerId: req.body.productOwnerId
            };

            const conversion = await analyticsService.logClickConversion(conversionData);

            res.json({
                success: true,
                data: conversion
            });
        } catch (error) {
            console.error('Error storing click conversion:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getClickConversionStats(req, res) {
        const { days } = req.query;
        if (!days || ![7, 30].includes(parseInt(days))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing "days" query parameter. Allowed values: 7, 30'
            });
        }

        try {
            const stats = await analyticsService.getClickConversionStats(days);
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting Click Conversion stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getTopSearchesStats(req, res) {
        const { days } = req.query;
        if (!days || ![7, 30].includes(parseInt(days))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing "days" query parameter. Allowed values: 7, 30'
            });
        }

        try {
            const stats = await analyticsService.getTopSearchesStats(days);
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting Top Searches stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getTendingCategoryStats(req, res) {
        const { days } = req.query;
        if (!days || ![7, 30].includes(parseInt(days))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing "days" query parameter. Allowed values: 7, 30'
            });
        }

        try {
            const stats = await analyticsService.getTrendingCategoryStats(days);
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting Trending Category stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getLocationStats(req, res) {
        const { days } = req.query;
        if (!days || ![7, 30].includes(parseInt(days))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing "days" query parameter. Allowed values: 7, 30'
            });
        }

        try {
            const stats = await analyticsService.getLocationStats(days);
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting Location stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new AnalyticsController();
