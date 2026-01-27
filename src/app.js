require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { initializeDatabase, sequelize } = require('./db');
const routes = require('./routes');
const { createUploadDirectories } = require('./config/upload');
const { optionalAuthenticateToken } = require('./middleware/auth');
const { dynamicRateLimit } = require('./middleware/rateLimit');
const { scheduleAnalyticsUpdate } = require('./analytics/analyticsCron');
const { scheduleBoostExpiration } = require('./cron/boostExpirationCron');

const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const paymentRoutes = require('./routes/payment');
const listing = require('./routes/listing');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const apolloServer = require('./graphql/server');
const playground = require('graphql-playground-middleware-express').default;

// Initialize Express app
const app = express();

// Enable trust proxy - this is needed when behind a reverse proxy
// Set to the number of proxies between the server and the client
app.set('trust proxy', 1);

// Basic middleware
// CORS configuration: allow credentials and specific origins (not *)
const allowedOrigins = process.env.CORS_ORIGINS.split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser or same-origin requests (no origin header)
    if (!origin) return callback(null, true);
    // In non-production or when explicitly enabled, allow any origin by reflecting it
    if (process.env.NODE_ENV !== 'production' || process.env.CORS_ALLOW_ALL === 'true') {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Device-Id'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
// Ensure preflight requests are handled
app.options('*', cors(corsOptions));
// app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// Attempt to identify user (non-blocking) before applying rate limits
app.use(optionalAuthenticateToken);

// Global dynamic rate limiting (guests vs authenticated users)
app.use(dynamicRateLimit);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check if database is initialized
    if (!sequelize || !sequelize.models.User) {
      return res.status(503).json({
        status: 'unhealthy',
        database: 'not_initialized',
        message: 'Database not initialized'
      });
    }

    // Test database connection
    await sequelize.authenticate();
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Database connection failed'
    });
  }
});

// Initialize app
const initApp = async () => {
  try {
    console.log('🚀 Initializing application...');

    // Initialize database first
    console.log('📦 Initializing database...');
    await initializeDatabase();

    // Verify database is initialized
    if (!sequelize || !sequelize.models.User) {
      throw new Error('Database initialization failed - models not available');
    }
    console.log('✅ Database initialized successfully');

    // Create upload directories
    console.log('📁 Creating upload directories...');
    createUploadDirectories();
    console.log('✅ Upload directories created');

    // Mount routes after database is initialized
    console.log('🛣️  Mounting routes...');
    app.use('/api', routes);
    app.use('/chat', chatRoutes);
    app.use('/auth', authRoutes);
    app.use('/search', searchRoutes);
    console.log('✅ Routes mounted');

    // Initialize Apollo Server
    console.log('🚀 Initializing GraphQL server...');
    await apolloServer.start();
    // Disable Apollo CORS, rely on Express-level CORS
    apolloServer.applyMiddleware({ app, path: '/graphql', cors: false });
    console.log('✅ GraphQL server initialized');

    // Initialize Analytics Cron Job
    console.log('⏰ Initializing analytics cron job...');
    scheduleAnalyticsUpdate();
    console.log('✅ Analytics cron job scheduled');

    // Initialize Boost Expiration Cron Job
    console.log('⏰ Initializing boost expiration cron job...');
    scheduleBoostExpiration();
    console.log('✅ Boost expiration cron job scheduled');

    // Add GraphQL Playground at /playground
    app.get('/playground', playground({ endpoint: '/graphql' }));

    // Error handling middleware should be last
    app.use(notFoundHandler);
    app.use(errorHandler);

    console.log('✅ Application initialized successfully');
    return app;
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    process.exit(1); // Exit if initialization fails
  }
};

// Export the app and initialization function
module.exports = { app, initApp };
