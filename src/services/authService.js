const jwt = require('jsonwebtoken');
const { User, Subscription, UserFeature, Conversation, ConversationHistory, Message, Feedback, Merchant } = require('../db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwksClient = require('jwks-rsa');
const { Op } = require('sequelize');
const Listing = require('../models/Listing'); // Fixed: Listing with capital L
const userStatsService = require('./userStatsService');
const GoogleService = require('./googleService');

class AuthService {
  constructor() {
    // Initialize Apple OAuth client
    this.appleKeyId = process.env.APPLE_KEY_ID; // From your key filename
    this.appleTeamId = process.env.APPLE_TEAM_ID;
    this.appleClientId = process.env.APPLE_CLIENT_ID;
    this.appleBundleId = process.env.APPLE_BUNDLE_ID;

    // JWT secret for our own tokens
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = '30d'; // Changed to 30 days (1 month)
    this.refreshTokenExpiresIn = '30d'; // Also extended refresh token to 30 days

    // Initialize JWKS client for Apple
    this.jwksClient = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5
    });

    // Initialize Google Service
    this.googleService = new GoogleService();
  }

  async verifyAppleToken(identityToken) {
    try {
      // Decode the token to get the kid (Key ID)
      const decodedToken = jwt.decode(identityToken, { complete: true });
      if (!decodedToken || !decodedToken.header || !decodedToken.header.kid) {
        throw new Error('Invalid token format');
      }

      // Get the public key from Apple's JWKS endpoint
      const key = await this.jwksClient.getSigningKey(decodedToken.header.kid);
      const publicKey = key.getPublicKey();

      // Verify the token
      const payload = jwt.verify(identityToken, publicKey, {
        algorithms: ['RS256'],
        audience: this.appleClientId, // Your app's client ID
        issuer: 'https://appleid.apple.com'
      });

      return payload;
    } catch (error) {
      console.error('Apple token verification failed:', error);
      throw new Error('Invalid Apple token');
    }
  }

  // Helper to map user fields to camelCase for API response
  mapUserToCamelCase(user) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      appleId: user.apple_id,
      googleId: user.google_id,
      lastLogin: user.last_login,
      status: user.status,
      country: user?.metadata?.country || null,
      verifiedStatus: user.verifiedStatus,
      analyticsAccessStatus: user.analyticsAccessStatus,
      // Add more fields as needed
    };
  }

  async handleAppleSignIn(identityToken, userData, location) {
    try {
      // Verify the Apple token
      const payload = await this.verifyAppleToken(identityToken);

      // Use Apple's sub (subject) as the unique identifier
      const appleSubId = payload.sub;

      // Always look up by apple_id
      let user = await User.findOne({
        where: { apple_id: appleSubId }
      });
      console.log('user', payload);

      if (user) {
        // User exists, update their information
        const updateData = {
          last_login: new Date(),
          location: location || user.location
        };

        // Only update email if we have a new one and it's different
        if (userData.email && userData.email !== user.email) {
          updateData.email = userData.email;
        }

        // Handle names - use provided names or keep existing, but ensure we have defaults
        if (userData.firstName) {
          updateData.first_name = userData.firstName;
        } else if (!user.first_name) {
          updateData.first_name = 'Anonymous';
        }

        if (userData.lastName) {
          updateData.last_name = userData.lastName;
        } else if (!user.last_name) {
          updateData.last_name = 'User';
        }

        // Update full_name if we have both names or need to set a default
        if (userData.firstName && userData.lastName) {
          updateData.full_name = `${userData.firstName} ${userData.lastName}`;
        } else if (!user.full_name) {
          updateData.full_name = 'Anonymous User';
        }

        await user.update(updateData);
      } else {
        // Try to create user, but handle unique constraint error
        const userDataToCreate = {
          apple_id: appleSubId,
          email: userData.email || payload.email || null,
          first_name: userData.firstName || 'Anonymous',
          last_name: userData.lastName || 'User',
          full_name: userData.firstName && userData.lastName
            ? `${userData.firstName} ${userData.lastName}`
            : 'Anonymous User',
          status: 'active',
          last_login: new Date(),
          location: location
        };
        Object.keys(userDataToCreate).forEach(key => {
          if (userDataToCreate[key] === null || userDataToCreate[key] === undefined) {
            delete userDataToCreate[key];
          }
        });

        console.log('userDataToCreate', userDataToCreate);

        try {
          user = await User.create(userDataToCreate);
          console.log('New user created:', user.id);

          // Invalidate user count cache and broadcast update
          await userStatsService.invalidateUserCountCache();

          // Broadcast user count update (don't wait for it)
          setTimeout(async () => {
            try {
              const userStatsController = require('../controllers/userStatsController');
              await userStatsController.broadcastUserCountUpdate();
            } catch (broadcastError) {
              console.error('Error broadcasting user count update:', broadcastError);
            }
          }, 100);

        } catch (err) {
          // If unique constraint error, fetch and update instead
          if (err.name === 'SequelizeUniqueConstraintError') {
            user = await User.findOne({ where: { apple_id: appleSubId } });
            if (user) {
              await user.update({
                email: userData.email || payload.email || user.email,
                first_name: userData.firstName || user.first_name || 'Anonymous',
                last_name: userData.lastName || user.last_name || 'User',
                full_name: userData.firstName && userData.lastName
                  ? `${userData.firstName} ${userData.lastName}`
                  : user.full_name || 'Anonymous User',
                last_login: new Date(),
                status: 'active',
                location: location || user.location
              });
            } else {
              throw err; // rethrow if not found
            }
          } else {
            throw err;
          }
        }
      }

      const { accessToken, refreshToken } = await this.generateTokens(user);

      // Log the response for debugging (use snake_case fields)
      console.log('[AuthService] User data:', {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        apple_id: user.apple_id
      });

      return {
        user: this.mapUserToCamelCase(user),
        accessToken,
        refreshToken
      };
    } catch (error) {
      console.error('Apple sign in failed:', error);
      throw error;
    }
  }

  async handleGoogleSignIn(idToken, userData, location) {
    try {
      // Verify the Google ID token
      const googleUserInfo = await this.googleService.verifyIdToken(idToken);

      // Use Google's sub (subject) as the unique identifier
      const googleId = googleUserInfo.googleId;

      // Always look up by google_id
      let user = await User.findOne({
        where: { google_id: googleId }
      });

      console.log('Google user info:', googleUserInfo);

      if (user) {
        // User exists, update their information
        const updateData = {
          last_login: new Date(),
          location: location || user.location
        };

        // Only update email if we have a new one and it's different
        if (googleUserInfo.email && googleUserInfo.email !== user.email) {
          updateData.email = googleUserInfo.email;
        }

        // Handle names - use provided names or keep existing, but ensure we have defaults
        if (userData?.firstName || googleUserInfo.givenName) {
          updateData.first_name = userData?.firstName || googleUserInfo.givenName;
        } else if (!user.first_name) {
          updateData.first_name = 'Anonymous';
        }

        if (userData?.lastName || googleUserInfo.familyName) {
          updateData.last_name = userData?.lastName || googleUserInfo.familyName;
        } else if (!user.last_name) {
          updateData.last_name = 'User';
        }

        // Update full_name if we have both names or need to set a default
        const firstName = userData?.firstName || googleUserInfo.givenName || user.first_name;
        const lastName = userData?.lastName || googleUserInfo.familyName || user.last_name;
        if (firstName && lastName) {
          updateData.full_name = `${firstName} ${lastName}`;
        } else if (!user.full_name) {
          updateData.full_name = googleUserInfo.name || 'Anonymous User';
        }

        await user.update(updateData);
      } else {
        // Try to create user, but handle unique constraint error
        const userDataToCreate = {
          google_id: googleId,
          email: googleUserInfo.email || userData?.email || null,
          first_name: userData?.firstName || googleUserInfo.givenName || 'Anonymous',
          last_name: userData?.lastName || googleUserInfo.familyName || 'User',
          full_name: googleUserInfo.name ||
            (userData?.firstName && userData?.lastName
              ? `${userData.firstName} ${userData.lastName}`
              : 'Anonymous User'),
          status: 'active',
          last_login: new Date(),
          isEmailVerified: googleUserInfo.emailVerified || false,
          location: location
        };

        // Remove null/undefined values
        Object.keys(userDataToCreate).forEach(key => {
          if (userDataToCreate[key] === null || userDataToCreate[key] === undefined) {
            delete userDataToCreate[key];
          }
        });

        console.log('Creating Google user:', userDataToCreate);

        try {
          user = await User.create(userDataToCreate);
        } catch (err) {
          // If unique constraint error, fetch and update instead
          if (err.name === 'SequelizeUniqueConstraintError') {
            user = await User.findOne({ where: { google_id: googleId } });
            if (user) {
              await user.update({
                email: googleUserInfo.email || userData?.email || user.email,
                first_name: userData?.firstName || googleUserInfo.givenName || user.first_name || 'Anonymous',
                last_name: userData?.lastName || googleUserInfo.familyName || user.last_name || 'User',
                full_name: googleUserInfo.name ||
                  (userData?.firstName && userData?.lastName
                    ? `${userData.firstName} ${userData.lastName}`
                    : user.full_name || 'Anonymous User'),
                last_login: new Date(),
                status: 'active',
                isEmailVerified: googleUserInfo.emailVerified || user.isEmailVerified || false,
                location: location || user.location
              });
            } else {
              throw err; // rethrow if not found
            }
          } else {
            throw err;
          }
        }
      }

      const { accessToken, refreshToken } = await this.generateTokens(user);

      // Log the response for debugging (use snake_case fields)
      console.log('[AuthService] Google user data:', {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        google_id: user.google_id
      });

      return {
        user: this.mapUserToCamelCase(user),
        accessToken,
        refreshToken
      };
    } catch (error) {
      console.error('Google sign in failed:', error);
      throw error;
    }
  }

  async generateTokens(user) {
    // Generate access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );

    // Generate refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Save refresh token to user
    await user.update({
      refresh_token: refreshToken,
      refresh_token_expires: refreshTokenExpires
    });

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken) {
    const user = await User.findOne({
      where: {
        refresh_token: refreshToken,
        refresh_token_expires: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      throw new Error('Invalid refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(user);

    return {
      accessToken,
      refreshToken: newRefreshToken
    };
  }

  async logout(userId) {
    await User.update(
      {
        refresh_token: null,
        refresh_token_expires: null
      },
      {
        where: { id: userId }
      }
    );
  }

  async getUserById(userId) {
    const user = await User.findByPk(userId, {
      include: [{
        model: Merchant,
        as: 'merchant',
        attributes: ['id', 'brand_name', 'logo_url']
      }]
    });
    if (!user) {
      throw new Error('User not found');
    }

    const userData = this.mapUserToCamelCase(user);
    // Add merchant data if exists
    if (user.merchant) {
      userData.logoUrl = user.merchant.logo_url; // Add logoUrl directly to userData
    }

    return userData;
  }

  async deleteUserAccount(userId) {
    try {

      const userConversations = await Conversation.findAll({
        where: { userId: userId },
        attributes: ['id']
      });

      const conversationIds = userConversations.map(conv => conv.id);

      if (conversationIds.length > 0) {
        await Message.destroy({
          where: { conversationId: conversationIds }
        });
      }


      await ConversationHistory.destroy({
        where: { conversationId: conversationIds.map(id => id.toString()) }
      });

      await Conversation.destroy({
        where: { userId: userId }
      });


      await UserFeature.destroy({
        where: { userId: userId }
      });


      await Subscription.destroy({
        where: { userId: userId }
      });

      await Feedback.destroy({
        where: { user_id: userId }
      });


      await Listing.deleteByUserId(userId);

      await User.destroy({
        where: { id: userId }
      });

      return true;
    } catch (error) {
      console.error('Error deleting user account:', error);
      throw new Error(`Failed to delete user account: ${error.message}`);
    }
  }
}

module.exports = new AuthService(); 