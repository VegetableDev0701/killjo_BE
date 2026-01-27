const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
const multer = require('multer');
const upload = multer();

const { authenticate } = require('../middleware/auth');

// Get all merchants
router.get('/', merchantController.getAllMerchants.bind(merchantController));

// Get merchants with boosted products
router.get('/boosted/products', merchantController.getMerchantsWithBoostedProducts.bind(merchantController));

// Get merchant from slug
router.get('/slug/:slug', merchantController.getMerchantBySlug.bind(merchantController));

// Get top 5 merchants
router.get('/top', merchantController.getTopMerchants.bind(merchantController));

// Get merchant by ID (user_id)
router.get('/:id', merchantController.getMerchantById.bind(merchantController));

// Get merchant products
router.get('/:id/products', merchantController.getMerchantProducts.bind(merchantController));

// Update merchant logo
router.post('/update-logo', authenticate, upload.fields([{ name: 'logo', maxCount: 1 }]), merchantController.updateMerchantLogo.bind(merchantController));

// Save store location (latitude, longitude)
router.post('/store-location', authenticate, merchantController.addStoreLocation.bind(merchantController));

module.exports = router;
