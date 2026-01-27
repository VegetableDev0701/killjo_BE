const authService = require('../services/authService');
const { getUserLocation } = require('../services/helperFunctions');

class AuthController {
  async appleSignIn(req, res) {
    try {
      // Handle both formats: identityToken/userData and idToken/user
      const identityToken = req.body.identityToken || req.body.idToken;
      const userData = req.body.userData || {
        email: req.body.email,
        firstName: req.body.user?.name?.firstName,
        lastName: req.body.user?.name?.lastName
      };

      if (!identityToken) {
        return res.status(400).json({
          success: false,
          message: 'Identity token is required'
        });
      }

      const location = await getUserLocation(req);
      const result = await authService.handleAppleSignIn(identityToken, userData, location);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Apple sign in error:', error);
      return res.status(401).json({
        success: false,
        message: error.message || 'Authentication failed'
      });
    }
  }

  async googleSignIn(req, res) {
    try {
      // Handle both formats: idToken and user data
      const identityToken = req.body.identityToken || req.body.idToken;
      const userData = req.body.userData || {
        email: req.body.email,
        firstName: req.body.user?.name?.firstName,
        lastName: req.body.user?.name?.lastName
      };
      console.log({ userData, identityToken });


      if (!identityToken) {
        return res.status(400).json({
          success: false,
          message: 'Google ID token is required'
        });
      }

      const location = await getUserLocation(req);
      const result = await authService.handleGoogleSignIn(identityToken, userData, location);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Google sign in error:', error);
      return res.status(401).json({
        success: false,
        message: error.message || 'Authentication failed'
      });
    }
  }

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      const tokens = await authService.refreshAccessToken(refreshToken);

      return res.status(200).json({
        success: true,
        data: tokens
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      return res.status(401).json({
        success: false,
        message: error.message || 'Token refresh failed'
      });
    }
  }

  async logout(req, res) {
    try {
      const userId = req.user.userId; // From JWT token
      await authService.logout(userId);

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  async getLoggedInUser(req, res) {
    try {
      const userId = req.user.id; // From JWT token

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = await authService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get logged in user error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve user information'
      });
    }
  }

  async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      await authService.deleteUserAccount(userId);

      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  }

}

module.exports = new AuthController(); 