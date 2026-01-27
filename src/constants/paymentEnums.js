// src/constants/paymentEnums.js

const PaymentType = Object.freeze({
    SUBSCRIPTION: 'subscription',
    IN_APP_PURCHASE: 'in_app_purchase',
});

const ProductType = Object.freeze({
    MONTHLY_SUBSCRIPTION: 'monthly_subscription',
    YEARLY_SUBSCRIPTION: 'yearly_subscription',
    BOOST: 'boost',
    MERCHANT_BOOST: 'merchant_boost',
    PROFILE_VERIFICATION: 'profile_verification',
});

const Duration = Object.freeze({
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    WEEKLY: 'weekly',
    LIFETIME: 'lifetime',
});

module.exports = {
    PaymentType,
    ProductType,
    Duration,
};
