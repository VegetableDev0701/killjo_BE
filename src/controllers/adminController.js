const { Admin, User } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Merchant, Feedback } = require('../db');
const Listing = require('../models/Listing');
const ScrappedDataService = require('../services/scrappedDataService');

const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const existing = await Admin.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Admin already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      email,
      passwordHash,
      lastLogin: new Date()
    });
    res.status(201).json({
      message: 'Admin registered',
      admin: { id: admin.id, email: admin.email }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register admin' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const jwtToken = jwt.sign({ adminId: admin.id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    await admin.update({ jwtToken, lastLogin: new Date() });
    res.json({
      message: 'Login successful',
      token: jwtToken,
      admin: { id: admin.id, email: admin.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// Get all users (paginated)
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { count, rows } = await User.findAndCountAll({
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });
    const hasNext = page * limit < count;
    res.json({
      total: count,
      page,
      limit,
      hasNext,
      users: rows
    });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get all listings (paginated)
const getAllListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;
    const offset = (page - 1) * limit;
    const { count, rows } = await Listing.getAllListings(offset, limit);
    const hasNext = page * limit < count;
    res.json({
      total: count,
      page,
      limit,
      hasNext,
      listings: rows
    });
  } catch (err) {
    console.error('Get all listings error:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

const getMyListings = async (req, res) => {
  try {
    const userId = req.admin.id;
    if (!userId) {
      return res.status(400).json({ error: 'Admin ID not found' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;
    const offset = (page - 1) * limit;
    const { count, rows } = await Listing.findByUserId(userId, limit, offset);
    const hasNext = page * limit < count;
    res.json({
      total: count,
      page,
      limit,
      hasNext,
      listings: rows
    });
  } catch (err) {
    console.error('Get my listings error:', err);
    res.status(500).json({ error: 'Failed to fetch your listings' });
  }
};

// Get all feedback (paginated)
const getAllFeedback = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { count, rows } = await Feedback.findAndCountAll({
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });
    const hasNext = page * limit < count;
    res.json({
      total: count,
      page,
      limit,
      hasNext,
      feedback: rows
    });
  } catch (err) {
    console.error('Get all feedback error:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};

const changeListing = async (req, res) => {
  try {
    const listingId = req.params.id;
    const { status } = req.body;

    if (!listingId || !status) {
      return res.status(400).json({ error: 'Listing ID and status are required' });
    }

    if (status != 'active' && status != 'paused') {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const listing = await Listing.update(listingId, { status: status });

    res.json({ message: 'Listing updated', listing });
  } catch (err) {
    console.error('Change listing error:', err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
};

const changeUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ error: 'User ID and status are required' });
    }

    if (status != 'active' && status != 'banned') {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ status });

    res.json({ message: 'User updated', user });
  } catch (err) {
    console.error('Change user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

const editUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { firstName, lastName, fullName, status, verifiedStatus, analyticsAccessStatus } = req.body;

    // Validate required userId
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare update object
    const updateData = {};

    // Validate and process firstName
    if (firstName !== undefined) {
      if (typeof firstName !== 'string') {
        return res.status(400).json({ error: 'firstName must be a string' });
      }
      const trimmedFirstName = firstName.trim();
      if (trimmedFirstName.length > 50) {
        return res.status(400).json({ error: 'firstName must be 50 characters or less' });
      }
      updateData.first_name = trimmedFirstName || null;
    }

    // Validate and process lastName
    if (lastName !== undefined) {
      if (typeof lastName !== 'string') {
        return res.status(400).json({ error: 'lastName must be a string' });
      }
      const trimmedLastName = lastName.trim();
      if (trimmedLastName.length > 50) {
        return res.status(400).json({ error: 'lastName must be 50 characters or less' });
      }
      updateData.last_name = trimmedLastName || null;
    }

    // Handle full_name - auto-generate if firstName and lastName are provided, or use explicit value
    if (fullName !== undefined) {
      if (typeof fullName !== 'string') {
        return res.status(400).json({ error: 'fullName must be a string' });
      }
      const trimmedFullName = fullName.trim();
      if (trimmedFullName.length > 100) {
        return res.status(400).json({ error: 'fullName must be 100 characters or less' });
      }
      updateData.full_name = trimmedFullName || null;
    } else if (firstName !== undefined && lastName !== undefined) {
      // Auto-generate full name if both firstName and lastName are being updated
      const newFirstName = updateData.first_name || user.first_name;
      const newLastName = updateData.last_name || user.last_name;
      if (newFirstName && newLastName) {
        updateData.full_name = `${newFirstName} ${newLastName}`;
      }
    }

    if (analyticsAccessStatus !== undefined) {
      if (typeof analyticsAccessStatus !== 'string') {
        return res.status(400).json({ error: 'analyticsAccessStatus must be a string' });
      }
      if (!['NO_ACCESS', 'APPROVED'].includes(analyticsAccessStatus)) {
        return res.status(400).json({
          error: 'analyticsAccessStatus must be one of: granted, revoked'
        });
      }
      updateData.analyticsAccessStatus = analyticsAccessStatus;
    }

    // Validate and process status
    if (status !== undefined) {
      if (typeof status !== 'string') {
        return res.status(400).json({ error: 'status must be a string' });
      }
      if (!['active', 'inactive', 'suspended'].includes(status)) {
        return res.status(400).json({
          error: 'status must be one of: active, inactive, suspended'
        });
      }
      updateData.status = status;
    }

    // Validate and process verifiedStatus
    if (verifiedStatus !== undefined) {
      if (typeof verifiedStatus !== 'string') {
        return res.status(400).json({ error: 'verifiedStatus must be a string' });
      }
      if (!['UNPAID', 'PAID', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'].includes(verifiedStatus)) {
        return res.status(400).json({
          error: 'verifiedStatus must be one of: UNPAID, PAID, UNDER_REVIEW, VERIFIED, REJECTED'
        });
      }
      updateData.verifiedStatus = verifiedStatus;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'At least one field must be provided to update: firstName, lastName, fullName, status, verifiedStatus'
      });
    }

    // Capture the previous verification status before updating
    const previousVerifiedStatus = user.verifiedStatus;

    const previousStatus = user.status;

    // Update user
    await user.update(updateData);

    let statusChanged = false;
    if (status && status !== previousStatus) {
      statusChanged = true;
      // If status changed, handle listing visibility
      if (status === 'suspended') {
        await updateOnStatusChange(userId, 'suspended', verifiedStatus);
      } else if (status === 'active') {
        await updateOnStatusChange(userId, 'active', verifiedStatus);
      } else {
        statusChanged = false;
      }
    }

    // Handle product visibility based on verification status change
    if (verifiedStatus !== previousVerifiedStatus && statusChanged === false) {
      if (verifiedStatus === 'REJECTED') {
        await updateOnVerifiedStatusChange(userId, 'suspended');
      } else if (verifiedStatus === 'VERIFIED' && previousVerifiedStatus !== 'VERIFIED') {
        await updateOnVerifiedStatusChange(userId, 'active');
      }
    }

    // Return updated user data
    const updatedUser = await User.findByPk(userId);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        fullName: updatedUser.full_name,
        status: updatedUser.status,
        verifiedStatus: updatedUser.verifiedStatus,
        email: updatedUser.email,
        updatedAt: updatedUser.updatedAt
      }
    });

  } catch (err) {
    console.error('Edit user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

const updateOnStatusChange = async (userId, status, verifiedStatus) => {
  if (!status) return;

  if (status === 'active') {
    if (verifiedStatus === 'VERIFIED') {
      try {
        const [showResult, scrappedResult] = await Promise.all([
          Listing.showAllListingsForUser(userId),
          ScrappedDataService.showScrappedDataByUserId(userId)
        ]);
        console.log(`Updated Status for user ${userId}. Restored ${showResult.restored} hidden products and ${scrappedResult.restored} scrapped products.`);
      } catch (error) {
        console.error('Error showing products after status activate:', error);
      }
      try {
        await Merchant.update(
          { status: status },
          { where: { user_id: userId } }
        );
      } catch (error) {
        console.error('Error updating merchant satatus on user update:', error);
      }
    } else {
      try {
        const showResult = await Listing.showLimitListingsForUser(userId);
        console.log(`Updated Status for user ${userId}. Activated first ${showResult.restored} listed products.`);
      } catch (error) {
        console.error('Error showing products after status activate:', error);
      }
    }

  } else if (status === 'suspended') {
    try {
      const [hideResult, scrappedResult] = await Promise.all([
        Listing.hideListingsBeyondLimit(userId, 0),
        ScrappedDataService.hideScrappedDataByUserId(userId)
      ]);

      console.log(`Updated Status for user ${userId}. Hidden ${hideResult.hidden} products beyond limit and ${scrappedResult.hidden} scrapped products. Merchant suspended.`);
    } catch (error) {
      console.error('Error hiding products after status suspend:', error);
    }

    try {
      await Merchant.update(
        { status: status },
        { where: { user_id: userId } }
      );
    } catch (error) {
      console.error('Error updating merchant satatus on user update:', error);
    }
  }
}
const updateOnVerifiedStatusChange = async (userId, status, limitedListing = 5) => {
  if (!status) return;

  if (status === 'active') {
    try {
      const [showResult, scrappedResult] = await Promise.all([
        Listing.showAllListingsForUser(userId),
        ScrappedDataService.showScrappedDataByUserId(userId)
      ]);
      console.log(`Verification granted for user ${userId}. Restored ${showResult.restored} hidden products and ${scrappedResult.restored} scrapped products. Merchant activated.`);
    } catch (error) {
      console.error('Error showing products after verification grant:', error);
    }
  } else if (status === 'suspended') {
    try {
      const [hideResult, scrappedResult] = await Promise.all([
        Listing.hideListingsBeyondLimit(userId, limitedListing),
        ScrappedDataService.hideScrappedDataByUserId(userId)
      ]);

      console.log(`Verification revoked for user ${userId}. Hidden ${hideResult.hidden} products beyond limit and ${scrappedResult.hidden} scrapped products. Merchant suspended.`);
    } catch (error) {
      console.error('Error hiding products after verification revocation:', error);
      // Don't fail the user update, just log the error
    }
  }

  try {
    await Merchant.update(
      { status: status },
      { where: { user_id: userId } }
    );
  } catch (error) {
    console.error('Error updating listing statuses based on verification change:', error);
  }



  // Placeholder for future status update logic
}

module.exports = {
  register,
  login,
  getAllUsers,
  getAllListings,
  getMyListings,
  getAllFeedback,
  changeListing,
  changeUser,
  editUser
};
