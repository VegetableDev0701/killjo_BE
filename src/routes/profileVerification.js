const express = require('express');
const router = express.Router();
const profileVerificationController = require('../controllers/profileVerificationController');
const { authenticateToken } = require('../middleware/auth');

// For file uploads (multer)
const multer = require('multer');
const upload = multer(); // Configure storage as needed

// POST: Create new profile verification (expects front & back images)
router.post(
  '/',
  authenticateToken,
  upload.fields([
    { name: 'front', maxCount: 1 },
  ]),
  profileVerificationController.createProfileVerification
);

// GET: List profile verifications with pagination
router.get('/', authenticateToken, profileVerificationController.listProfileVerifications);



module.exports = router;
