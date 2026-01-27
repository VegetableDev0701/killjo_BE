

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { sendErrorResponse } = require('../utils/common');
const { authenticateToken } = require('../middleware/auth');


router.use(authenticateToken);


router.post('/validate', (req, res) => {
    paymentController.validatePayment(req, res)
        .catch(err => {
            console.error('Payment validation error:', err);
            sendErrorResponse(res, 500, 'Internal server error');
        });
});

router.post('/webhook', (req, res) => {
    paymentController.handleNotification(req, res)
        .catch(err => {
            console.error('Apple notification handling error:', err);
            sendErrorResponse(res, 500, 'Internal server error');
        });
});

router.post('/test-notification', (req, res) => {
    paymentController.sendTestNotification(req, res)
        .catch(err => {
            console.error('Test notification error:', err);
            sendErrorResponse(res, 500, 'Internal server error');
        });
});


router.get('/subscription/me', (req, res) => {
    paymentController.getUserSubscription(req, res)
        .catch(err => {
            console.error('Subscription status fetch error:', err);
            sendErrorResponse(res, 500, 'Internal server error');
        });
});

router.get('/subscription/:userId', (req, res) => {
    paymentController.getUserSubscription(req, res)
        .catch(err => {
            console.error('Subscription status fetch error:', err);
            sendErrorResponse(res, 500, 'Internal server error');
        });
});

router.get('/feature/:userId/:featureType', (req, res) => {
    paymentController.checkUserFeature(req, res)
        .catch(err => {
            console.error('Feature check error:', err);
            sendErrorResponse(res, 500, 'Internal server error');
        });
});

router.post('/feature/:userId/:featureType/use', (req, res) => {
    paymentController.useFeature(req, res)
        .catch(err => {
            console.error('Feature usage error:', err);
            sendErrorResponse(res, 500, 'Internal server error');
        });
});


router.get('/history', (req, res) => {
    paymentController.getPaymentHistory(req, res)
        .catch(err => {
            console.error('Payment history fetch error:', err);
            sendErrorResponse(res, 500, 'Internal server error');
        });
});

module.exports = router;

