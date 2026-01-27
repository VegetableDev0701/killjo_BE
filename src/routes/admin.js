const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const profileVerificationController = require('../controllers/profileVerificationController');
const merchantController = require('../controllers/merchantController');

if (process.env.NODE_ENV !== 'production') {
  router.post('/register', adminController.register);
} else {
  router.post('/register', (req, res) => {
    return res.status(403).json({ error: 'Admin registration is disabled in production' });
  });
}
router.post('/login', adminController.login);
// Protected admin routes
router.get('/users', adminAuth, adminController.getAllUsers);
router.put('/users/:id', adminAuth, adminController.editUser);

router.get('/listings', adminAuth, adminController.getAllListings);
router.get('/my-listings', adminAuth, adminController.getMyListings);
router.get('/feedback', adminAuth, adminController.getAllFeedback);
router.post('/listings/change/:id', adminAuth, adminController.changeListing);




// user verification routes
router.get('/verification/user/:id',adminAuth, profileVerificationController.getUserVerification);
router.post('/verifications/approved',adminAuth, profileVerificationController.approveVerification);
router.post('/verifications/rejected',adminAuth, profileVerificationController.rejectVerification);

//merchant edit

router.post('/merchant/edit',adminAuth, merchantController.EditMerchant.bind(merchantController))

module.exports = router;
