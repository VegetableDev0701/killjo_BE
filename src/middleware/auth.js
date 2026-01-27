const jwt = require('jsonwebtoken');
const { User, sequelize } = require('../db'); // Import both User model and sequelize instance

const jwtSecret = process.env.JWT_SECRET;

// Middleware to authenticate user or admin
const authenticateUserOrAdmin = async (req, res, next) => {
  try {
    if (!sequelize || !sequelize.models || !sequelize.models.User) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable - database not initialized'
      });
    }

    const authHeader = req.headers['authorization']; // Bearer <token>
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication token is required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.userId) {
        const user = await User.findOne({
          where: { id: decoded.userId, status: 'active' }
        });
        if (!user) {
          return res.status(401).json({ success: false, message: 'User not found or inactive' });
        }

        // Check if user has been logged out
        if (!user.refresh_token || !user.refresh_token_expires) {
          return res.status(401).json({ success: false, message: 'Token has been invalidated. Please log in again.' });
        }

        // Check if refresh token has expired
        if (new Date() > user.refresh_token_expires) {
          return res.status(401).json({ success: false, message: 'Session has expired. Please log in again.' });
        }

        req.user = {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          country: user?.metadata?.country,
          location: user.location
        };
        return next();
      }

      if (decoded.adminId) {
        const Admin = sequelize.models.Admin;
        const admin = Admin && (await Admin.findByPk(decoded.adminId));
        if (!admin) {
          return res.status(401).json({ success: false, message: 'Admin not found' });
        }
        req.admin = admin; // expose admin context
        return next();
      }
    } catch (jwtError) {
      // Fallback for Apple ID tokens used by users (non-JWT)
      const user = await User.findOne({
        where: { apple_id: token, status: 'active' }
      });
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          location: user.location
        };
        return next();
      }

      // Not a valid user or admin token
      return res.status(401).json({ success: false, message: 'Invalid token or user not found' });
    }
  } catch (error) {
    console.error('Auth (user/admin) error:', error);
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

const authenticateToken = async (req, res, next) => {
  try {
    // Check if database is initialized
    if (!sequelize || !sequelize.models.User) {
      console.error('Database not initialized');
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable - database not initialized'
      });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is required'
      });
    }

    // Try to verify as JWT first
    try {
      const decoded = jwt.verify(token, jwtSecret);
      // Check if user exists and is active
      const user = await User.findOne({
        where: {
          id: decoded.userId,
          status: 'active'
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Check if user has been logged out (refresh_token should exist for valid sessions)
      if (!user.refresh_token || !user.refresh_token_expires) {
        return res.status(401).json({
          success: false,
          message: 'Token has been invalidated. Please log in again.'
        });
      }

      // Check if refresh token has expired
      if (new Date() > user.refresh_token_expires) {
        return res.status(401).json({
          success: false,
          message: 'Session has expired. Please log in again.'
        });
      }


      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        location: user.location
      };

      return next();
    } catch (jwtError) {
      // If JWT verification fails, try to find user by Apple ID
      // Note: apple_id can be null for users who hide their email
      const user = await User.findOne({
        where: {
          apple_id: token, // Use token as Apple ID
          status: 'active'
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token or user not found'
        });
      }

      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        location: user.location
      };

      return next();
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Optional authentication middleware - tries to authenticate but doesn't block if it fails
const optionalAuthenticateToken = async (req, res, next) => {
  try {
    // Check if database is initialized
    if (!sequelize || !sequelize.models.User) {
      console.log('Database not initialized, proceeding without authentication');
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('No authentication token provided, proceeding without authentication');
      return next();
    }

    // Try to verify as JWT first
    try {
      const decoded = jwt.verify(token, jwtSecret);
      // Check if user exists and is active
      const user = await User.findOne({
        where: {
          id: decoded.userId,
          status: 'active'
        }
      });

      if (!user) {
        console.log('User not found or inactive, proceeding without authentication');
        return next();
      }

      // Check if user has been logged out (for optional auth, just skip if logged out)
      if (!user.refresh_token || !user.refresh_token_expires) {
        console.log('User has been logged out, proceeding without authentication');
        return next();
      }

      // Check if refresh token has expired (for optional auth, just skip if expired)
      if (new Date() > user.refresh_token_expires) {
        console.log('User session has expired, proceeding without authentication');
        return next();
      }

      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        location: user.location
      };

      console.log(`User authenticated: ${user.email}`);
      return next();
    } catch (jwtError) {
      // If JWT verification fails, try to find user by Apple ID
      const user = await User.findOne({
        where: {
          apple_id: token, // Use token as Apple ID
          status: 'active'
        }
      });

      if (!user) {
        console.log('Invalid token or user not found, proceeding without authentication');
        return next();
      }

      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        location: user.location
      };

      console.log(`User authenticated via Apple ID: ${user.email}`);
      return next();
    }
  } catch (error) {
    console.error('Optional auth error:', error);
    // Don't block the request, just proceed without authentication
    return next();
  }
};

// Generate JWT token for user
const generateToken = user => {
  return jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '30d' });
};

// Export both the original name and an alias for backward compatibility
module.exports = {
  authenticateToken,
  authenticate: authenticateToken, // Alias for backward compatibility
  optionalAuthenticateToken,
  generateToken,
  authenticateUserOrAdmin
};
