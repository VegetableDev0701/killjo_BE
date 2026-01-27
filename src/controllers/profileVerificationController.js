const { ProfileVerification, User } = require('../db');
const minioService = require('../services/minioService');
const Listing = require('../models/Listing');
const MerchantController = require('./merchantController');

exports.createProfileVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appleIdName, brandName, category } = req.body;

    // Check if user has PAID status
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.verifiedStatus !== 'PAID') {
      return res.status(400).json({ error: 'User must have PAID status to create profile verification.' });
    }

    if (!appleIdName || !brandName || !category) {
      return res.status(400).json({ error: 'Apple ID name, brand name, and category are required.' });
    }

    if (!req.files || !req.files.front) {
      return res.status(400).json({ error: 'Front cédula image is required.' });
    }

    const [frontUpload] = await Promise.all([
      minioService.uploadImage(req.files.front[0], 'profile-verification'),
    ]);

    const resultPending = await User.update({ verifiedStatus: 'UNDER_REVIEW' }, { where: { id: userId } });


    let verification = await ProfileVerification.findOne({ where: { userId } });
    if (verification) {

      if (verification.cedulaFrontImageUrl) {
        await minioService.deleteImage(verification.cedulaFrontImageUrl);
      }

      await verification.update({
        appleIdName,
        cedulaFrontImageUrl: frontUpload.publicUrl,
        status: 'UNDER_REVIEW',
        brandName,
        category
      });
    } else {

      verification = await ProfileVerification.create({
        userId,
        appleIdName,
        cedulaFrontImageUrl: frontUpload.publicUrl,
        status: 'UNDER_REVIEW',
        brandName,
        category
      });
    }
    res.status(201).json(verification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create profile verification.' });
  }
};

// GET /profile-verification?page=1&pageSize=20
exports.listProfileVerifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const verifications = await ProfileVerification.findAll({
      where: { userId },
      include: [{ model: User, attributes: ['id', 'full_name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ verifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to list profile verifications.' });
  }
};

exports.approveVerification = async (req, res) => {
  try {
    const { userId, brandName } = req.body;

    if (!userId || !brandName) {
      return res.status(400).json({ error: 'User ID and brand name are required.' });
    }

    const verification = await User.findOne({ where: { id: userId, verifiedStatus: 'UNDER_REVIEW' } });

    if (!verification) {
      return res.status(404).json({ error: 'No user found under review.' });
    }

    // Get the profile verification to retrieve the category
    const profileVerification = await ProfileVerification.findOne({ where: { userId } });
    if (!profileVerification) {
      return res.status(404).json({ error: 'Profile verification not found.' });
    }

    // create merchant record
    const { Merchant } = require('../db');

    const merchantPayload = {
      user_id: userId,
      brand_name: brandName,
      category: profileVerification.category,
    };

    const merchant = await Merchant.create(merchantPayload);
    if (!merchant) {
      return res.status(500).json({ error: 'Failed to create merchant record.' });
    }

    // update verification status and user verifiedStatus
    await Promise.all([
      MerchantController.generateAndSaveQRCode(merchant),
      User.update({ verifiedStatus: 'VERIFIED' }, { where: { id: userId } }),
      ProfileVerification.update({ status: 'VERIFIED' }, { where: { userId } }),
      Listing.updateAAllListingsVerifiedbadgeByUser(userId, true)
    ]);

    res.json({ message: 'Merchant created successfully.', verification });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to approve profile verification.' });
  }
};


exports.rejectVerification = async (req, res) => {
  try {
    const { userId, rejectionReason } = req.body;
    if (!userId || !rejectionReason) {
      return res.status(400).json({ error: 'User ID and rejection reason are required.' });
    }
    const verification = await ProfileVerification.findOne({ where: { userId } });
    if (!verification) {
      return res.status(404).json({ error: 'Profile verification not found.' });
    }
    await verification.update({ status: 'REJECTED', rejectionReason });
    await User.update({ verifiedStatus: 'PAID' }, { where: { id: verification.userId } });
    res.json({ message: 'Profile verification rejected.', verification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject profile verification.' });
  }
};


exports.getUserVerification = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required.' });
    }

    const verification = await ProfileVerification.findOne({ where: { userId } });
    if (!verification) {
      return res.status(404).json({ error: 'Profile verification not found.' });
    }
    res.json(verification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user verification.' });
  }
};
