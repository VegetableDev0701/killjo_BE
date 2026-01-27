const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GooglePlayService {
    constructor() {
        this.initializeClient();
    }

    /**
     * Initialize Google Play Developer API client
     */
    initializeClient() {
        try {
            let credentials;
            // Option 1: Check default path
            if(process.env.NODE_ENV === "development") {
                const defaultPath = path.join(__dirname, '../../certificates/nodo-469518-f603c7b807ad.json');
                if (fs.existsSync(defaultPath)) {
                    credentials = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
                    console.log('Using Google Play service account from default path:', defaultPath);
                }
            }

            // Option 2: Use GOOGLE_SERVICE_ACCOUNT_JSON environment variable (for deployed environments)
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                try {
                    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
                    console.log('Using Google Play service account from GOOGLE_SERVICE_ACCOUNT_JSON environment variable');
                } catch (parseError) {
                    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', parseError);
                    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
                }
            }

            this.auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/androidpublisher']
            });

            this.androidpublisher = google.androidpublisher({
                version: 'v3',
                auth: this.auth
            });

            this.packageName = process.env.APPLE_BUNDLE_ID;

            console.log('Google Play Service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Google Play Service:', error);
            throw new Error('Google Play Service initialization failed');
        }
    }

    /**
     * Verify a product (in-app purchase) from Google Play
     * @param {string} productId - The product ID
     * @param {string} purchaseToken - The purchase token
     * @returns {Promise<Object>} - Purchase details
     */
    async verifyProduct(productId, purchaseToken) {
        try {
            const response = await this.androidpublisher.purchases.products.get({
                packageName: this.packageName,
                productId: productId,
                token: purchaseToken
            });

            const purchase = response.data;

            // Validate purchase state
            // 0 = Purchased, 1 = Canceled, 2 = Pending
            if (purchase.purchaseState !== 0) {
                throw new Error('Purchase is not in purchased state');
            }

            // Check if purchase is consumed or acknowledged
            // consumptionState: 0 = Yet to be consumed, 1 = Consumed
            // acknowledgementState: 0 = Yet to be acknowledged, 1 = Acknowledged

            return {
                orderId: purchase.orderId,
                productId: productId,
                purchaseToken: purchaseToken,
                purchaseTime: purchase.purchaseTimeMillis ? parseInt(purchase.purchaseTimeMillis) : null,
                purchaseState: purchase.purchaseState,
                consumptionState: purchase.consumptionState,
                acknowledgementState: purchase.acknowledgementState,
                developerPayload: purchase.developerPayload,
                purchaseType: purchase.purchaseType, // 0 = Test, 1 = Promo, null = Standard
                kind: purchase.kind,
                regionCode: purchase.regionCode,
                obfuscatedExternalAccountId: purchase.obfuscatedExternalAccountId
            };
        } catch (error) {
            console.error('Failed to verify product purchase:', error);
            throw new Error(`Failed to validate purchase with Google Play: ${error.message}`);
        }
    }

    /**
     * Verify a subscription purchase from Google Play
     * @param {string} subscriptionId - The subscription ID
     * @param {string} purchaseToken - The purchase token
     * @returns {Promise<Object>} - Subscription details
     */
    async verifySubscription(subscriptionId, purchaseToken) {
        try {
            const response = await this.androidpublisher.purchases.subscriptions.get({
                packageName: this.packageName,
                subscriptionId: subscriptionId,
                token: purchaseToken
            });

            const subscription = response.data;

            // Validate payment state
            // paymentState: 0 = Payment pending, 1 = Payment received, 2 = Free trial, 3 = Pending deferred upgrade/downgrade
            const isValid = subscription.paymentState === 1 || 
                           subscription.paymentState === 2 || 
                           subscription.paymentState === 3;

            if (!isValid && subscription.paymentState !== undefined) {
                throw new Error('Subscription payment is not valid');
            }

            // Check if subscription is active
            const expiryTime = subscription.expiryTimeMillis ? parseInt(subscription.expiryTimeMillis) : null;
            const now = Date.now();
            const isActive = expiryTime && expiryTime > now;

            return {
                orderId: subscription.orderId,
                subscriptionId: subscriptionId,
                purchaseToken: purchaseToken,
                startTime: subscription.startTimeMillis ? parseInt(subscription.startTimeMillis) : null,
                expiryTime: expiryTime,
                autoRenewing: subscription.autoRenewing || false,
                priceCurrencyCode: subscription.priceCurrencyCode,
                priceAmountMicros: subscription.priceAmountMicros,
                countryCode: subscription.countryCode,
                paymentState: subscription.paymentState,
                cancelReason: subscription.cancelReason,
                userCancellationTime: subscription.userCancellationTimeMillis 
                    ? parseInt(subscription.userCancellationTimeMillis) 
                    : null,
                acknowledgementState: subscription.acknowledgementState,
                linkedPurchaseToken: subscription.linkedPurchaseToken,
                purchaseType: subscription.purchaseType,
                profileId: subscription.profileId,
                emailAddress: subscription.emailAddress,
                givenName: subscription.givenName,
                familyName: subscription.familyName,
                profileName: subscription.profileName,
                obfuscatedExternalAccountId: subscription.obfuscatedExternalAccountId,
                isActive: isActive,
                kind: subscription.kind
            };
        } catch (error) {
            console.error('Failed to verify subscription:', error);
            throw new Error(`Failed to validate subscription with Google Play: ${error.message}`);
        }
    }

    /**
     * Acknowledge a product purchase
     * @param {string} productId - The product ID
     * @param {string} purchaseToken - The purchase token
     * @returns {Promise<void>}
     */
    async acknowledgeProduct(productId, purchaseToken) {
        try {
            await this.androidpublisher.purchases.products.acknowledge({
                packageName: this.packageName,
                productId: productId,
                token: purchaseToken
            });

            console.log(`Product purchase acknowledged: ${productId}`);
        } catch (error) {
            console.error('Failed to acknowledge product purchase:', error);
            throw new Error(`Failed to acknowledge purchase: ${error.message}`);
        }
    }

    /**
     * Acknowledge a subscription purchase
     * @param {string} subscriptionId - The subscription ID
     * @param {string} purchaseToken - The purchase token
     * @returns {Promise<void>}
     */
    async acknowledgeSubscription(subscriptionId, purchaseToken) {
        try {
            await this.androidpublisher.purchases.subscriptions.acknowledge({
                packageName: this.packageName,
                subscriptionId: subscriptionId,
                token: purchaseToken
            });

            console.log(`Subscription acknowledged: ${subscriptionId}`);
        } catch (error) {
            console.error('Failed to acknowledge subscription:', error);
            throw new Error(`Failed to acknowledge subscription: ${error.message}`);
        }
    }

    /**
     * Consume a product purchase (for consumable items)
     * @param {string} productId - The product ID
     * @param {string} purchaseToken - The purchase token
     * @returns {Promise<void>}
     */
    async consumeProduct(productId, purchaseToken) {
        try {
            await this.androidpublisher.purchases.products.consume({
                packageName: this.packageName,
                productId: productId,
                token: purchaseToken
            });

            console.log(`Product consumed: ${productId}`);
        } catch (error) {
            console.error('Failed to consume product:', error);
            throw new Error(`Failed to consume product: ${error.message}`);
        }
    }

    /**
     * Refund a subscription
     * @param {string} subscriptionId - The subscription ID
     * @param {string} purchaseToken - The purchase token
     * @returns {Promise<void>}
     */
    async refundSubscription(subscriptionId, purchaseToken) {
        try {
            await this.androidpublisher.purchases.subscriptions.refund({
                packageName: this.packageName,
                subscriptionId: subscriptionId,
                token: purchaseToken
            });

            console.log(`Subscription refunded: ${subscriptionId}`);
        } catch (error) {
            console.error('Failed to refund subscription:', error);
            throw new Error(`Failed to refund subscription: ${error.message}`);
        }
    }

    /**
     * Revoke a subscription
     * @param {string} subscriptionId - The subscription ID
     * @param {string} purchaseToken - The purchase token
     * @returns {Promise<void>}
     */
    async revokeSubscription(subscriptionId, purchaseToken) {
        try {
            await this.androidpublisher.purchases.subscriptions.revoke({
                packageName: this.packageName,
                subscriptionId: subscriptionId,
                token: purchaseToken
            });

            console.log(`Subscription revoked: ${subscriptionId}`);
        } catch (error) {
            console.error('Failed to revoke subscription:', error);
            throw new Error(`Failed to revoke subscription: ${error.message}`);
        }
    }
}

module.exports = GooglePlayService;
