const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../db');
const { verifyAppleToken, exchangeAppleCodeForTokens } = require('../utils/appleAuth');
const { generateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const userController = require('../controllers/userController');
const userStatsService = require('../services/userStatsService');
const { broadcastUserCount } = require('../socket');
const GoogleService = require('../services/googleService');
const { getUserLocation } = require('../services/helperFunctions');



const router = express.Router();

/**
 * Apple Sign In endpoint using ID token
 * POST /auth/apple/token
 */

router.post('/apple/token', async (req, res) => {
  try {
    const { idToken, user: userInfo } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify the ID token from Apple
    const appleUserInfo = await verifyAppleToken(idToken);

    if (!appleUserInfo.sub) {
      return res.status(400).json({ error: 'Invalid Apple ID token' });
    }

    // Find or create user by Apple ID
    let user = await User.findOne({ where: { apple_id: appleUserInfo.sub } });

    if (user && user.status === 'suspended') {
      return res.status(403).json({ error: 'This user account was suspended' });
    } else if (user) {
      // Update user's last login
      await user.update({ last_login: new Date() });
    } else {
      // Create new user from Apple data
      const email = appleUserInfo.email || null;
      let firstName = null, lastName = null, fullName = null;

      // Extract user info if provided
      if (userInfo && userInfo.name) {
        firstName = userInfo.name.firstName || 'Anonymous';
        lastName = userInfo.name.lastName || 'User';
        if (firstName && lastName) {
          fullName = `${firstName} ${lastName}`;
        } else {
          fullName = 'Anonymous User';
        }
      } else {
        // Handle anonymous user
        firstName = 'New';
        lastName = 'User';
        fullName = 'New User';
      }

      user = await User.create({
        apple_id: appleUserInfo.sub,
        email,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        last_login: new Date(),
        location: await getUserLocation(req)
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      }
    });
  } catch (error) {
    console.error('Apple Sign In error:', error);
    res.status(500).json({ error: `Authentication failed: ${error.message}` });
  }
});

/**
 * Apple Sign In endpoint using authorization code
 * POST /auth/apple/code
 */
router.post('/apple/code', async (req, res) => {
  try {
    const { code, user: userInfo } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange the code for tokens
    const tokens = await exchangeAppleCodeForTokens(code);

    if (!tokens.id_token) {
      return res.status(400).json({ error: 'Failed to get ID token from Apple' });
    }

    // Verify the ID token
    const appleUserInfo = await verifyAppleToken(tokens.id_token);

    if (!appleUserInfo.sub) {
      return res.status(400).json({ error: 'Invalid Apple ID token' });
    }

    // Find or create user by Apple ID
    let user = await User.findOne({ where: { apple_id: appleUserInfo.sub } });

    if (user && user.status === 'suspended') {
      return res.status(403).json({ error: 'This user account was suspended' });
    } else if (!user) {
      // Create new user from Apple data
      const email = appleUserInfo.email || null;
      let firstName = null, lastName = null, fullName = null;

      // Extract user info if provided
      if (userInfo && userInfo.name) {
        firstName = userInfo.name.firstName || 'Anonymous';
        lastName = userInfo.name.lastName || 'User';
        if (firstName && lastName) {
          fullName = `${firstName} ${lastName}`;
        } else {
          fullName = 'Anonymous User';
        }
      } else {
        // Handle anonymous user
        firstName = 'New';
        lastName = 'User';
        fullName = 'New User';
      }

      user = await User.create({
        apple_id: appleUserInfo.sub,
        email,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        last_login: new Date(),
        location: await getUserLocation(req)
      });
    } else {
      // Update user's last login
      await user.update({ last_login: new Date() });
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      }
    });
  } catch (error) {
    console.error('Apple Sign In with code error:', error);
    res.status(500).json({ error: `Authentication failed: ${error.message}` });
  }
});

/**
 * Google Sign In endpoint using ID token (for mobile apps)
 * POST /auth/google/token
 */
router.post('/google/token', async (req, res) => {
  try {
    const { idToken, user: userInfo } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    // Initialize Google service
    const googleService = new GoogleService();

    // Verify the ID token from Google
    const googleUserInfo = await googleService.verifyIdToken(idToken);

    if (!googleUserInfo.googleId) {
      return res.status(400).json({ error: 'Invalid Google ID token' });
    }

    // Find or create user by Google ID
    let user = await User.findOne({ where: { google_id: googleUserInfo.googleId } });

    if (user && user.status === 'suspended') {
      return res.status(403).json({ error: 'This user account is suspended' });
    } else if (!user) {
      // Create new user from Google data
      const email = googleUserInfo.email || null;
      let firstName = null, lastName = null, fullName = null;

      // Extract user info from Google or provided data
      if (userInfo && (userInfo.firstName || userInfo.lastName)) {
        firstName = userInfo.firstName || googleUserInfo.givenName || 'Anonymous';
        lastName = userInfo.lastName || googleUserInfo.familyName || 'User';
      } else {
        firstName = googleUserInfo.givenName || 'New';
        lastName = googleUserInfo.familyName || 'User';
      }

      fullName = googleUserInfo.name || `${firstName} ${lastName}`;

      user = await User.create({
        google_id: googleUserInfo.googleId,
        email,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        last_login: new Date(),
        isEmailVerified: googleUserInfo.emailVerified || false,
        location: await getUserLocation(req)
      });
    } else {
      // Update user's last login and any new info
      const updateData = { last_login: new Date() };
      updateData.location = await getUserLocation(req) || user.location;

      // Update email if different
      if (googleUserInfo.email && googleUserInfo.email !== user.email) {
        updateData.email = googleUserInfo.email;
      }

      // Update names if provided
      if (userInfo?.firstName || googleUserInfo.givenName) {
        updateData.first_name = userInfo?.firstName || googleUserInfo.givenName;
      }
      if (userInfo?.lastName || googleUserInfo.familyName) {
        updateData.last_name = userInfo?.lastName || googleUserInfo.familyName;
      }

      // Update full name
      if (googleUserInfo.name) {
        updateData.full_name = googleUserInfo.name;
      } else if (updateData.first_name || updateData.last_name) {
        updateData.full_name = `${updateData.first_name || user.first_name} ${updateData.last_name || user.last_name}`;
      }

      await user.update(updateData);
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      }
    });
  } catch (error) {
    console.error('Google Sign In error:', error);
    res.status(500).json({ error: `Authentication failed: ${error.message}` });
  }
});

/**
 * DEVELOPMENT ONLY: Dummy Google Sign In endpoint for testing
 * POST /auth/dummy/google
 */
router.post('/dummy/google', async (req, res) => {
  try {
    // In a real scenario, these would come from Google
    const { email = 'dummy.google@example.com', firstName = 'Google', lastName = 'User', location = {} } = req.body;

    // Create a fake Google ID (in reality this is a complex string from Google)
    const fakeGoogleId = `dummy-google-id-${uuidv4()}`;

    // Find or create user by fake Google ID or email
    let user = null;

    if (email) {
      user = await User.findOne({ where: { email } });
    }

    if (!user) {
      // Calculate full name
      const fullName = firstName && lastName ? `${firstName} ${lastName}` : 'Google User';

      // Create new user
      user = await User.create({
        google_id: fakeGoogleId,
        email,
        first_name: firstName || 'Google',
        last_name: lastName || 'User',
        full_name: fullName,
        last_login: new Date(),
        isEmailVerified: true, // Google emails are typically verified
        location: await getUserLocation(req)
      });

      console.log(`Created dummy Google user: ${email} with ID: ${user.id}`);
    } else {
      // Update existing user
      await user.update({
        first_name: firstName || user.first_name || 'Google',
        last_name: lastName || user.last_name || 'User',
        full_name: firstName && lastName ? `${firstName} ${lastName}` : user.full_name || 'Google User',
        last_login: new Date(),
        google_id: user.google_id || fakeGoogleId, // Add Google ID if not present
        location: await getUserLocation(req) || user.location
      });

      console.log(`Updated existing user with Google: ${email} with ID: ${user.id}`);
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
      message: "DUMMY GOOGLE LOGIN - FOR DEVELOPMENT ONLY"
    });
  } catch (error) {
    console.error('Dummy Google Sign In error:', error);
    res.status(500).json({ error: `Authentication failed: ${error.message}` });
  }
});

/**
 * DEVELOPMENT ONLY: Dummy Apple Sign In endpoint for testing
 * POST /auth/dummy/apple
 */
router.post('/dummy/apple', async (req, res) => {
  try {
    // In a real scenario, these would come from Apple
    const { email = 'dummy@example.com', firstName = 'John', lastName = 'Doe', location = {} } = req.body;

    // Create a fake Apple ID (in reality this is a complex string from Apple)
    const fakeAppleId = `dummy-apple-id-${uuidv4()}`;

    // Find or create user by fake Apple ID or email
    let user = null;

    if (email) {
      user = await User.findOne({ where: { email } });
    }

    if (!user) {
      // Calculate full name
      const fullName = firstName && lastName ? `${firstName} ${lastName}` : 'Anonymous User';

      // Create new user
      user = await User.create({
        apple_id: fakeAppleId,
        email,
        first_name: firstName || 'Anonymous',
        last_name: lastName || 'User',
        full_name: fullName,
        last_login: new Date(),
        location: await getUserLocation(req)
      });

      console.log(`Created dummy user: ${email} with ID: ${user.id}`);

      // Invalidate user count cache and broadcast update
      await userStatsService.invalidateUserCountCache();

      // Broadcast user count update (don't wait for it)
      setTimeout(async () => {
        try {
          const count = await userStatsService.getTotalRegisteredUsers();
          await broadcastUserCount(count);
          console.log('User count update broadcasted after dummy user creation');
        } catch (broadcastError) {
          console.error('Error broadcasting user count update:', broadcastError);
        }
      }, 100);
    } else {
      // Update existing user
      await user.update({
        first_name: firstName || user.first_name || 'Anonymous',
        last_name: lastName || user.last_name || 'User',
        full_name: firstName && lastName ? `${firstName} ${lastName}` : user.full_name || 'Anonymous User',
        last_login: new Date(),
        location: await getUserLocation(req) || user.location
      });

      console.log(`Updated existing user: ${email} with ID: ${user.id}`);
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
      message: "DUMMY LOGIN - FOR DEVELOPMENT ONLY"
    });
  } catch (error) {
    console.error('Dummy Apple Sign In error:', error);
    res.status(500).json({ error: `Authentication failed: ${error.message}` });
  }
});

/**
 * Verify token endpoint
 * GET /auth/verify
 */
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by id
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    } else if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This user account is suspended' });
    }

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
});

// Apple Sign In
router.post('/apple/signin', authController.appleSignIn);

// Google Sign In
router.post('/google/signin', authController.googleSignIn);

// Refresh token
router.post('/refresh-token', authController.refreshToken);

// Logout (requires authentication)
router.post('/logout', authenticateToken, authController.logout);

router.get('/me', authenticateToken, authController.getLoggedInUser);
router.delete('/me/delete', authenticateToken, authController.deleteAccount);

// Add user favorites endpoints
router.post('/users/favorites/toggle', authenticateToken, userController.toggleFavorite);
router.get('/users/favorites', authenticateToken, userController.getFavorites);

// Add user profile update endpoints
router.put('/users/name', authenticateToken, userController.updateName);
router.put('/users/email', authenticateToken, userController.updateEmail);
router.post('/users/country', authenticateToken, userController.updateCountry);

module.exports = router; 