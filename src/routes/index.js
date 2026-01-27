const express = require('express');
const router = express.Router();

// Import route modules

const listingRoutes = require('./listing.js');
const searchRoutes = require('./search');
const authRoutes = require('./auth');
const paymentRoutes = require('./payment');
const feedbackRoutes = require('./feedback');
const adminRoutes = require('./admin');
const profileVerificationRoutes = require('./profileVerification');
const analyticsRoutes = require('./analytics');
const merchantRoutes = require('./merchant');
const labsRoutes = require('./labs');


// Mount routes

router.use('/listings', listingRoutes);
router.use('/search', searchRoutes);
router.use('/auth', authRoutes);
router.use('/premium', listingRoutes);
router.use('/payment', paymentRoutes);
router.use('/transcribe', require('./transcribe'));
router.use('/feedback', feedbackRoutes);
router.use('/admin', adminRoutes);
router.use('/profile-verification', profileVerificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/merchant', merchantRoutes);
router.use('/labs', labsRoutes);

// Base route for API version info
router.get('/', (req, res) => {
  res.json({
    name: 'Nodo.ia API',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      unified: '/unified',
      listings: '/listings',
      search: '/search',
      auth: '/auth'
    }
  });
});

module.exports = router; 
