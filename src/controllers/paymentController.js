const AppleService = require('../services/appleService');
const GooglePlayService = require('../services/googlePlayService');
const { Subscription, UserFeature, sequelize, User, Merchant } = require('../db');
const { Op } = require('sequelize');
const Listing = require('../models/Listing');
const redisService = require('../services/redisService');


const ProductDetails = {
    "com.nodoia.nodo.featured.v1":{
        duration: "weekly",
        product_type: "boost",
        payment_type: "in_app_purchase"
    },
    "com.nodoia.nodo.urgent.v1":{
        duration: "lifetime",
        product_type: "profile_verification",
        payment_type: "in_app_purchase"
    },
    "com.nodoia.nodo.featured.v2":{
        duration: "monthly",
        product_type: "merchant_boost",
        payment_type: "in_app_purchase"
    },
    "com.nodoia.nodo.monthly":{
        duration: "monthly",
        product_type: "monthly_subscription",
        payment_type: "subscription"
    },
    "com.nodoia.nodo.yearly":{
        duration: "yearly",
        product_type: "yearly_subscription",
        payment_type: "subscription"
    },
}

class PaymentController {
    constructor() {
        this.appleService = new AppleService();
        try {
            this.googlePlayService = new GooglePlayService();
        } catch (error) {
            console.warn('Google Play Service not initialized:', error.message);
            this.googlePlayService = null;
        }
    }

    // Validate payment from frontend
    async validatePayment(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const frontendPayload = req.body;
            const {
                transaction_id,
                product_id,
                purchaseToken,
                platform, // 'ios' or 'android'
                platformProductId,
            } = frontendPayload;

            console.log('Payment validation request:', { transaction_id, product_id, platform, platformProductId });

            const userId = req.user.id; 
            
            // Validate required fields
            if (!userId || !transaction_id) {
                await transaction.rollback();
                console.error('Missing required fields for payment validation');
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            // Determine platform - default to iOS for backward compatibility
            const purchasePlatform = platform?.toLowerCase() || 'ios';

            // For Android, purchaseToken is required
            if (purchasePlatform === 'android' && !purchaseToken) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'Purchase token is required for Android purchases'
                });
            }

            // Check if transaction already exists
            const existingSubscription = await Subscription.findOne({
                where: { transactionId: transaction_id },
                transaction
            });

            if (existingSubscription) {
                await transaction.rollback();
                console.error('Transaction already processed');
                return res.status(400).json({
                    success: false,
                    error: 'Transaction already processed'
                });
            }

            // Validate and process based on platform
            let transactionInfo;
            
            if (purchasePlatform === 'android') {
                // Validate with Google Play
                transactionInfo = await this.validateAndroidPurchase(
                    platformProductId, 
                    purchaseToken, 
                );
            } else {
                // Validate with Apple (iOS)
                transactionInfo = await this.appleService.getTransactionInfo(transaction_id);
            }
            
            // Get product details from predefined ProductDetails
            const productDetails = ProductDetails[platformProductId];
            if (!productDetails) {
                await transaction.rollback();
                console.error(`Unknown product ID: ${platformProductId}`);
                return res.status(400).json({
                    success: false,
                    error: `Unknown product ID: ${platformProductId}`
                });
            }

            const { payment_type, product_type, duration } = productDetails;

            if (product_type === 'boost' && !product_id) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'Missing product ID for boost product type'
                });
            }

            if (product_type === 'merchant_boost') {
                // Verify merchant exists for this user
                const merchant = await Merchant.findOne({
                    where: { user_id: userId },
                    transaction
                });

                if (!merchant) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'Merchant not found for this user'
                    });
                }
            }

            // Validate the transaction based on platform
            let validationResult;
            if (purchasePlatform === 'android') {
                validationResult = await this.validateGooglePlayTransaction(
                    userId,
                    transactionInfo,
                    frontendPayload
                );
            } else {
                validationResult = await this.validateAppleTransaction(
                    userId, 
                    transactionInfo, 
                    frontendPayload
                );
            }

            if (!validationResult.success) {
                console.error('Transaction validation failed:', validationResult.error);
                await transaction.rollback();
                return res.status(400).json(validationResult);
            }

            // Calculate expiration date
            const purchaseDate = purchasePlatform === 'android' 
                ? new Date(transactionInfo.purchaseTime || transactionInfo.startTime)
                : new Date(transactionInfo.purchaseDate);
            const expiresDate = this.calculateExpirationDate(purchaseDate, duration, product_type);

            // Prepare subscription data
            const subscriptionData = {
                userId,
                transactionId: transaction_id,
                paymentType: payment_type,
                productId: product_id,
                productType: product_type,
                duration,
                purchaseDate,
                expiresDate,
                isActive: true,
                platform: purchasePlatform,
                frontendPayload,
                status: 'active'
            };

            // Add platform-specific data
            if (purchasePlatform === 'android') {
                subscriptionData.originalTransactionId = transactionInfo.orderId;
                subscriptionData.amount = transactionInfo.priceAmountMicros 
                    ? (transactionInfo.priceAmountMicros / 1000000).toFixed(2)
                    : 0.00;
                subscriptionData.currency = transactionInfo.priceCurrencyCode || 'USD';
                subscriptionData.environment = transactionInfo.purchaseType === 0 ? 'Sandbox' : 'Production';
                subscriptionData.googlePlayTransactionData = transactionInfo;
                subscriptionData.autoRenewStatus = transactionInfo.autoRenewing || false;
            } else {
                subscriptionData.originalTransactionId = transactionInfo.originalTransactionId;
                subscriptionData.amount = transactionInfo.price;
                subscriptionData.currency = transactionInfo.currency;
                subscriptionData.environment = transactionInfo.environment;
                subscriptionData.appleTransactionData = transactionInfo;
                subscriptionData.autoRenewStatus = true; // Default for Apple
            }

            // Create subscription record
            const subscription = await Subscription.create(subscriptionData, { transaction });

            // Create user features based on product type
            await this.createUserFeatures(userId, subscription, transaction);

            await transaction.commit();

            res.json({
                success: true,
                subscription: {
                    id: subscription.id,
                    transactionId: subscription.transactionId,
                    productType: subscription.productType,
                    duration: subscription.duration,
                    expiresDate: subscription.expiresDate,
                    isActive: subscription.isActive,
                    autoRenewStatus: subscription.autoRenewStatus,
                    amount: subscription.amount,
                    currency: subscription.currency
                }
            });

        } catch (error) {
            await transaction.rollback();
            console.error('Payment validation error:', error);
            res.status(500).json({
                success: false,
                error: 'Payment validation failed'
            });
        }
    }

    // Calculate expiration date based on duration
    calculateExpirationDate(purchaseDate, duration, productType) {
        const date = new Date(purchaseDate);
        
        // One-time purchases don't expire
        if (productType === 'profile_verification') {
            return null;
        }

        switch (duration) {
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
            case 'lifetime':
                return null; // Lifetime subscriptions don't expire
            default:
                throw new Error('Invalid duration');
        }
        
        return date;
    }

    // Create user features based on subscription
    async createUserFeatures(userId, subscription, transaction) {
        const features = [];

        switch (subscription.productType) {
            case 'monthly_subscription':
            case 'yearly_subscription':
                features.push({
                    userId,
                    featureType: 'premium_subscription',
                    subscriptionId: subscription.id,
                    isActive: true,
                    activatedAt: subscription.purchaseDate,
                    expiresAt: subscription.expiresDate
                });
                break;

            case 'boost':

                // update Listing table with new boost information
                await Listing.UpdateBoostingInformation(
                    subscription.productId,
                    1,
                    subscription.expiresDate,
                    userId
                );

                // Invalidate boosted merchants cache
                redisService.invalidateBoostedMerchantsCache().catch((err) =>
                    console.error('Error invalidating boosted merchants cache:', err)
                );

                features.push({
                    userId,
                    featureType: 'boost',
                    subscriptionId: subscription.id,
                    isActive: true,
                    activatedAt: subscription.purchaseDate,
                    expiresAt: subscription.expiresDate,
                });
                break;

            case 'merchant_boost':
                // Update merchant with boost information (same way as Listing table)
                const merchant = await Merchant.findOne({
                    where: { user_id: userId },
                    transaction
                });

                if (merchant) {
                    // Update merchant with boost score and boost_expire timestamp
                    await merchant.update(
                        { 
                            boost: 1, 
                            boost_expire: subscription.expiresDate 
                        },
                        { transaction }
                    );
                }

                // Invalidate boosted merchants cache
                redisService.invalidateBoostedMerchantsCache().catch((err) =>
                    console.error('Error invalidating boosted merchants cache:', err)
                );

                features.push({
                    userId,
                    featureType: 'merchant_boost',
                    subscriptionId: subscription.id,
                    isActive: true,
                    activatedAt: subscription.purchaseDate,
                    expiresAt: subscription.expiresDate
                });
                break;

            case 'profile_verification':
                
                await Promise.all([
                    User.update(
                        { verifiedStatus: 'PAID' },
                        { where: { id: userId }, transaction }
                    )
                ]);

                features.push({
                    userId,
                    featureType: 'profile_verification',
                    subscriptionId: subscription.id,
                    isActive: true,
                    activatedAt: subscription.purchaseDate,
                    expiresAt: null 
                });
                break;
        }

        if (features.length > 0) {
            await UserFeature.bulkCreate(features, { transaction });
        }
    }

    // Get boost count based on product ID
    getBoostCount(productId) {
        const boostCounts = {
            'boost_1': 1,
            'boost_5': 5,
            'boost_10': 10,
            'boost_super': 100
        };
        return boostCounts[productId] || 1;
    }

    // Validate Android purchase with Google Play
    async validateAndroidPurchase(productId, purchaseToken) {
        if (!this.googlePlayService) {
            throw new Error('Google Play Service is not available');
        }

        try {
            // Check if it's a subscription or a product based on ProductDetails
            const productDetails = ProductDetails[productId];
            
            if (!productDetails) {
                throw new Error(`Unknown product ID: ${productId}`);
            }

            let purchaseInfo;
            
            if (productDetails.payment_type === 'subscription') {
                // Verify subscription
                purchaseInfo = await this.googlePlayService.verifySubscription(productId, purchaseToken);
                
                // Acknowledge the subscription if not already acknowledged
                if (purchaseInfo.acknowledgementState === 0) {
                    await this.googlePlayService.acknowledgeSubscription(productId, purchaseToken);
                }
            } else {
                // Verify in-app product
                purchaseInfo = await this.googlePlayService.verifyProduct(productId, purchaseToken);
                
                // Acknowledge the product if not already acknowledged
                if (purchaseInfo.acknowledgementState === 0) {
                    await this.googlePlayService.acknowledgeProduct(productId, purchaseToken);
                }
            }

            return purchaseInfo;
        } catch (error) {
            console.error('Android purchase validation error:', error);
            throw error;
        }
    }

    // Validate transaction with Google Play
    async validateGooglePlayTransaction(userId, googlePlayTransactionInfo, frontendPayload) {
        // Validate purchase state (should be 0 = Purchased)
        if (googlePlayTransactionInfo.purchaseState !== undefined && 
            googlePlayTransactionInfo.purchaseState !== 0) {
            return {
                success: false,
                error: 'Purchase is not in purchased state'
            };
        }

        // For subscriptions, validate payment state
        if (googlePlayTransactionInfo.paymentState !== undefined) {
            const validPaymentStates = [1, 2, 3]; // Payment received, Free trial, or Pending
            if (!validPaymentStates.includes(googlePlayTransactionInfo.paymentState)) {
                return {
                    success: false,
                    error: 'Subscription payment is not valid'
                };
            }
        }

        // Check if purchase/subscription is not expired
        if (googlePlayTransactionInfo.expiryTime && 
            googlePlayTransactionInfo.expiryTime < Date.now()) {
            return {
                success: false,
                error: 'Purchase has expired'
            };
        }

        return { success: true };
    }

    // Validate transaction with Apple
    async validateAppleTransaction(userId, appleTransactionInfo, frontendPayload) {
        // Check if transaction belongs to the correct app
        if (appleTransactionInfo.bundleId !== process.env.APPLE_BUNDLE_ID) {
            return {
                success: false,
                error: 'Transaction does not belong to this app'
            };
        }

        // Check if transaction is not revoked
        if (appleTransactionInfo.revocationDate) {
            return {
                success: false,
                error: 'Transaction has been revoked'
            };
        }

        // Check if subscription is not expired (for renewals)
        if (appleTransactionInfo.expiresDate && 
            new Date(appleTransactionInfo.expiresDate) < new Date()) {
            return {
                success: false,
                error: 'Subscription has expired'
            };
        }

        return { success: true };
    }

    // Handle Apple Server Notifications (webhooks for renewals)
    async handleNotification(req, res) {
        try {
            const { signedPayload } = req.body;

            if (!signedPayload) {
                return res.status(400).json({ error: 'Missing signedPayload' });
            }

            // Verify and decode the notification
            const notification = await this.appleService.verifyNotification(signedPayload);
            
            console.log('Received notification:', notification.notificationType);

            // Handle different notification types
            await this.processNotification(notification);

            res.status(200).json({ status: 'OK' });

        } catch (error) {
            console.error('Notification processing error:', error);
            res.status(200).json({ status: 'ERROR', error: error.message });
        }
    }

    // Process different types of notifications
    async processNotification(notification) {
        const { notificationType, data } = notification;

        if (!data || !data.signedTransactionInfo) {
            console.log('No transaction data in notification');
            return;
        }

        const transactionInfo = await this.appleService.verifier.verifyAndDecodeTransaction(
            data.signedTransactionInfo
        );

        switch (notificationType) {
            case 'DID_RENEW':
                await this.handleRenewal(transactionInfo);
                break;
                
            case 'EXPIRED':
                await this.handleExpiration(transactionInfo);
                break;
                
            case 'DID_FAIL_TO_RENEW':
                await this.handleFailedRenewal(transactionInfo);
                break;
                
            case 'SUBSCRIBED':
                await this.handleNewSubscription(transactionInfo);
                break;
                
            case 'DID_CHANGE_RENEWAL_STATUS':
                await this.handleRenewalStatusChange(transactionInfo, data.signedRenewalInfo);
                break;
                
            case 'REFUND':
                await this.handleRefund(transactionInfo);
                break;
                
            case 'TEST':
                await this.handleTestNotification(transactionInfo, data);
                break;
                
            default:
                console.log('Unhandled notification type:', notificationType);
        }
    }

    // Handle subscription renewal
    async handleRenewal(transactionInfo) {
        const transaction = await sequelize.transaction();
        
        try {
            console.log('Processing renewal for transaction:', transactionInfo.transactionId);
            
            // Find the original subscription
            const originalSubscription = await Subscription.findOne({
                where: {
                    originalTransactionId: transactionInfo.originalTransactionId
                },
                order: [['created_at', 'DESC']],
                transaction
            });

            if (originalSubscription) {
                // Create new subscription record for the renewal
                const renewalSubscription = await Subscription.create({
                    userId: originalSubscription.userId,
                    transactionId: transactionInfo.transactionId,
                    originalTransactionId: transactionInfo.originalTransactionId,
                    paymentType: originalSubscription.paymentType,
                    productId: originalSubscription.productId,
                    productType: originalSubscription.productType,
                    duration: originalSubscription.duration,
                    amount: originalSubscription.amount,
                    currency: originalSubscription.currency,
                    purchaseDate: new Date(transactionInfo.purchaseDate),
                    expiresDate: new Date(transactionInfo.expiresDate),
                    isActive: true,
                    environment: transactionInfo.environment,
                    platform: 'ios',
                    appleTransactionData: transactionInfo,
                    status: 'active',
                    renewalCount: originalSubscription.renewalCount + 1,
                    lastRenewalDate: new Date()
                }, { transaction });

                // Deactivate old subscription
                await Subscription.update(
                    { isActive: false, status: 'expired' },
                    { 
                        where: { 
                            originalTransactionId: transactionInfo.originalTransactionId,
                            id: { [Op.ne]: renewalSubscription.id }
                        },
                        transaction 
                    }
                );

                // Update user features for the new subscription period
                await this.updateUserFeaturesForRenewal(
                    originalSubscription.userId, 
                    renewalSubscription, 
                    transaction
                );

                await transaction.commit();
                console.log('Renewal processed successfully');
            } else {
                await transaction.rollback();
                console.error('Original subscription not found for renewal');
            }
        } catch (error) {
            await transaction.rollback();
            console.error('Error processing renewal:', error);
        }
    }

    // Update user features for renewal
    async updateUserFeaturesForRenewal(userId, subscription, transaction) {
        // Deactivate old premium features
        await UserFeature.update(
            { isActive: false },
            {
                where: {
                    userId,
                    featureType: 'premium_subscription',
                    isActive: true
                },
                transaction
            }
        );

        // Create new premium feature for the renewed subscription
        if (subscription.productType.includes('subscription')) {
            await UserFeature.create({
                userId,
                featureType: 'premium_subscription',
                subscriptionId: subscription.id,
                isActive: true,
                activatedAt: subscription.purchaseDate,
                expiresAt: subscription.expiresDate
            }, { transaction });
        }
    }

    // Handle subscription expiration
    async handleExpiration(transactionInfo) {
        const transaction = await sequelize.transaction();
        
        try {
            // Update subscription status
            await Subscription.update(
                { 
                    isActive: false,
                    autoRenewStatus: false,
                    status: 'expired'
                },
                { 
                    where: { originalTransactionId: transactionInfo.originalTransactionId },
                    transaction 
                }
            );

            // Deactivate related features
            const subscriptions = await Subscription.findAll({
                where: { originalTransactionId: transactionInfo.originalTransactionId },
                transaction
            });

            for (const subscription of subscriptions) {
                await UserFeature.update(
                    { isActive: false },
                    {
                        where: { subscriptionId: subscription.id },
                        transaction
                    }
                );
            }

            await transaction.commit();
            console.log('Subscription expired:', transactionInfo.originalTransactionId);
        } catch (error) {
            await transaction.rollback();
            console.error('Error processing expiration:', error);
        }
    }

    // Handle failed renewal
    async handleFailedRenewal(transactionInfo) {
        try {
            await Subscription.update(
                { autoRenewStatus: false },
                { 
                    where: { 
                        originalTransactionId: transactionInfo.originalTransactionId,
                        isActive: true
                    }
                }
            );
            
            console.log('Failed renewal processed:', transactionInfo.originalTransactionId);
        } catch (error) {
            console.error('Error processing failed renewal:', error);
        }
    }

    // Handle refund
    async handleRefund(transactionInfo) {
        const transaction = await sequelize.transaction();
        
        try {
            // Update subscription status
            const subscription = await Subscription.findOne({
                where: { transactionId: transactionInfo.transactionId },
                transaction
            });

            if (subscription) {
                await subscription.update({
                    isActive: false,
                    autoRenewStatus: false,
                    status: 'refunded'
                }, { transaction });

                // Deactivate related features
                await UserFeature.update(
                    { isActive: false },
                    {
                        where: { subscriptionId: subscription.id },
                        transaction
                    }
                );
            }

            await transaction.commit();
            console.log('Refund processed:', transactionInfo.transactionId);
        } catch (error) {
            await transaction.rollback();
            console.error('Error processing refund:', error);
        }
    }

    // Handle new subscription (from notifications)
    async handleNewSubscription(transactionInfo) {
        try {
            // This could happen if a user purchases directly through the App Store
            // without going through our app's purchase flow
            console.log('New subscription detected from App Store notification');
            console.log('Consider implementing logic to handle direct App Store purchases');
            
        } catch (error) {
            console.error('Error processing new subscription notification:', error);
        }
    }

    // Handle renewal status change
    async handleRenewalStatusChange(transactionInfo, signedRenewalInfo) {
        try {
            console.log('Processing renewal status change:', transactionInfo.originalTransactionId);
            
            // Decode renewal info if provided
            let renewalInfo = null;
            if (signedRenewalInfo) {
                renewalInfo = await this.appleService.verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo);
                console.log('Auto-renew status:', renewalInfo.autoRenewStatus);
            }

            // Update subscription auto-renew status
            await Subscription.update(
                { 
                    autoRenewStatus: renewalInfo ? renewalInfo.autoRenewStatus : false 
                },
                { 
                    where: { 
                        originalTransactionId: transactionInfo.originalTransactionId,
                        isActive: true
                    }
                }
            );
            
            console.log('Renewal status updated successfully');
            
        } catch (error) {
            console.error('Error processing renewal status change:', error);
        }
    }

    // Handle test notification
    async handleTestNotification(transactionInfo, data) {
        try {
            console.log('Processing TEST notification');
            console.log('Transaction info:', {
                transactionId: transactionInfo?.transactionId,
                originalTransactionId: transactionInfo?.originalTransactionId,
                productId: transactionInfo?.productId,
                bundleId: transactionInfo?.bundleId
            });
            
            // Log the test notification data for debugging
            if (data) {
                console.log('Test notification data keys:', Object.keys(data));
                
                // Check if there's renewal info for testing auto-renewable subscriptions
                if (data.signedRenewalInfo) {
                    console.log('Test notification includes renewal info');
                }
            }
            
            // For test notifications, we typically just log the information
            // and validate that our webhook endpoint is working correctly
            console.log('Test notification processed successfully');
            
        } catch (error) {
            console.error('Error processing test notification:', error);
        }
    }

    // Get user's subscription status
    async getUserSubscription(req, res) {
        try {
            const userId = req.user.id;

            // Get active subscriptions
            const subscriptions = await Subscription.findAll({
                where: {
                    userId,
                    isActive: true,
                    [Op.or]: [
                        { expiresDate: { [Op.gt]: new Date() } },
                        { expiresDate: null } // Lifetime subscriptions
                    ]
                },
                order: [['created_at', 'DESC']],
                include: [{
                    model: UserFeature,
                    as: 'features',
                    where: { isActive: true },
                    required: false
                }]
            });

            // Get active features
            const activeFeatures = await UserFeature.findAll({
                where: {
                    userId,
                    isActive: true,
                    [Op.or]: [
                        { expiresAt: { [Op.gt]: new Date() } },
                        { expiresAt: null }
                    ]
                }
            });

            res.json({
                success: true,
                hasActiveSubscription: subscriptions.length > 0,
                subscriptions: subscriptions.map(sub => ({
                    id: sub.id,
                    productType: sub.productType,
                    duration: sub.duration,
                    expiresDate: sub.expiresDate,
                    autoRenewStatus: sub.autoRenewStatus,
                    purchaseDate: sub.purchaseDate,
                    amount: sub.amount,
                    currency: sub.currency,
                    status: sub.status
                })),
                activeFeatures: activeFeatures.map(feature => ({
                    featureType: feature.featureType,
                    activatedAt: feature.activatedAt,
                    expiresAt: feature.expiresAt,
                    usageCount: feature.usageCount,
                    maxUsage: feature.maxUsage
                }))
            });

        } catch (error) {
            console.error('Error getting user subscription:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get subscription status'
            });
        }
    }

    // Check if user has specific feature
    async checkUserFeature(req, res) {
        try {
            const { userId, featureType } = req.params;

            const feature = await UserFeature.findOne({
                where: {
                    userId,
                    featureType,
                    isActive: true,
                    [Op.or]: [
                        { expiresAt: { [Op.gt]: new Date() } },
                        { expiresAt: null }
                    ]
                }
            });

            res.json({
                success: true,
                hasFeature: !!feature,
                feature: feature ? {
                    featureType: feature.featureType,
                    activatedAt: feature.activatedAt,
                    expiresAt: feature.expiresAt,
                    usageCount: feature.usageCount,
                    maxUsage: feature.maxUsage,
                    canUse: !feature.maxUsage || feature.usageCount < feature.maxUsage
                } : null
            });

        } catch (error) {
            console.error('Error checking user feature:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check feature status'
            });
        }
    }

    // Use a feature (like boost)
    async useFeature(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const { userId, featureType } = req.params;

            const feature = await UserFeature.findOne({
                where: {
                    userId,
                    featureType,
                    isActive: true,
                    [Op.or]: [
                        { expiresAt: { [Op.gt]: new Date() } },
                        { expiresAt: null }
                    ]
                },
                transaction
            });

            if (!feature) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    error: 'Feature not found or expired'
                });
            }

            // Check if feature has usage limit
            if (feature.maxUsage && feature.usageCount >= feature.maxUsage) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'Feature usage limit reached'
                });
            }

            // Increment usage count
            await feature.update({
                usageCount: feature.usageCount + 1
            }, { transaction });

            // If max usage reached, deactivate feature
            if (feature.maxUsage && feature.usageCount + 1 >= feature.maxUsage) {
                await feature.update({ isActive: false }, { transaction });
            }

            await transaction.commit();

            res.json({
                success: true,
                usageCount: feature.usageCount + 1,
                remainingUsage: feature.maxUsage ? feature.maxUsage - (feature.usageCount + 1) : null
            });

        } catch (error) {
            await transaction.rollback();
            console.error('Error using feature:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to use feature'
            });
        }
    }

    // Send test notification
    async sendTestNotification(req, res) {
        try {
            const { notificationType } = req.body;
            
            // Validate notification type
            const validTypes = [
                'SUBSCRIBED', 
                'DID_RENEW', 
                'EXPIRED', 
                'DID_FAIL_TO_RENEW',
                'DID_CHANGE_RENEWAL_STATUS',
                'PRICE_INCREASE',
                'REFUND'
            ];

            const typeToSend = notificationType && validTypes.includes(notificationType) 
                ? notificationType 
                : 'SUBSCRIBED';

            const result = await this.appleService.sendTestNotification(typeToSend);

            res.json({
                success: true,
                message: result.message,
                testNotificationToken: result.testNotificationToken,
                notificationType: typeToSend
            });

        } catch (error) {
            console.error('Error sending test notification:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to send test notification'
            });
        }
    }

}

module.exports = new PaymentController();
