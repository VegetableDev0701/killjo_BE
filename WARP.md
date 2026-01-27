# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Starting the Application
```bash
npm run dev          # Start development server with nodemon
npm start            # Start production server
```

### Database Operations
```bash
# Migrations
npx sequelize-cli db:create              # Create database
npx sequelize-cli db:migrate             # Run all pending migrations
npm run migrate                          # Shorthand for db:migrate
npm run migrate:undo                     # Undo last migration

# Seeders
npm run seed                             # Run all seeders
npm run seed:undo                        # Undo all seeders
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
npm test             # Run Jest tests
```

### Special Scripts
```bash
# Vector search and embeddings
npm run generate-embeddings              # Generate embeddings for real estate data
npm run generate-real-estate-embeddings  # Generate real estate specific embeddings
npm run generate-product-embeddings      # Generate product embeddings
npm run test-vector-search               # Test vector search functionality

# Database optimization
npm run optimize-db                      # Optimize database performance
npm run create-hnsw-indexes              # Create HNSW indexes for vector search
npm run optimize-vector-search           # Optimize vector search configuration

# Apple and Google Sign-In testing
npm run fix-apple-id                     # Fix Apple ID constraints
npm run test-apple-signin                # Test Apple Sign-In flow
## Project Overview

Nodo.ia Backend is a Node.js/Express API for a business and listing management platform with comprehensive features including authentication, subscription management, analytics, and search capabilities.

### Specialized Scripts

The project includes many specialized scripts for data management and optimization:

```bash
# Vector search and embeddings
npm run generate-embeddings
npm run test-vector-search
npm run optimize-vector-search

# Data migration and optimization
npm run optimize-db
npm run unified-search
npm run migrate-optimized

# Apple Sign In testing
npm run test-apple-signin

# Location data processing
npm run fetch-unique-locations
npm run clean-locations
npm run geocode-locations

# MinIO storage testing
npm run test-unified-minio
npm run start-minio
npm run stop-minio
```

## Architecture Overview

### Application Entry Points
- **src/server.js**: Main server entry point that starts HTTP server and Socket.io
- **src/app.js**: Express application setup with middleware, routes, and initialization logic
- **src/socket.js**: Socket.io server for real-time user count updates

### Core Architecture Components

#### Authentication Flow
- JWT-based authentication with refresh tokens
- Support for Apple Sign-In and Google Sign-In (OAuth)
- Middleware in `src/middleware/auth.js`:
  - `authenticateToken`: Strict JWT authentication
  - `optionalAuthenticateToken`: Non-blocking authentication for guest access
  - `authenticateUserOrAdmin`: Supports both user and admin authentication
- Session management via refresh tokens with expiration checking
- Fallback support for Apple ID tokens (non-JWT)

#### Database Architecture
- **ORM**: Sequelize with PostgreSQL
- **Configuration**: `src/config/sequelize.js` for environment-based DB config
- **Database Files**:
  - `src/db/index.js`: Main database initialization and model associations
  - `src/db/models/`: Sequelize model definitions
  - `src/db/migrations/`: Schema migrations
- **Dual Database Pattern**: 
  - Primary database via `DATABASE_URL` (user, auth, subscriptions)
  - Secondary listing database via `LISTING_URL` (listings, categories)
- **Model Files** (src/db/models/):
  - User, Admin, Subscription, UserFeature
  - Conversation, Message, ConversationHistory
  - Feedback, ProfileVerification
  - Article, ArticleView, ArticleLike
  - Merchant
- **Business Models** (src/models/):
  - Category.js: Direct PostgreSQL pool for category management
  - Listing.js: Listing management with vector search integration
  - SearchQuery.js: Search query tracking

#### Search System Architecture
The search system uses a hybrid approach combining traditional DB queries, vector search, and AI:

1. **Search Services** (src/services/search/):
   - `aiChatService.js`: AI-powered conversational search
   - `vectorSearchService.js`: Semantic search using pgvector
   - `databaseSearchService.js`: Traditional SQL-based search
   - `webSearchService.js`: External web search integration
   - `ragService.js`: Retrieval-Augmented Generation for enhanced results
   - `intentDetector.js`: Detect user search intent
   - `languageDetector.js`: Detect query language
   - `queryGenerator.js`: Generate optimized search queries
   - `responseGenerator.js`: Format search responses

2. **Vector Search**:
   - Uses pgvector extension with HNSW indexes
   - Embeddings generated via OpenAI API
   - Stored alongside listings for semantic similarity search

#### Payment Integration
- **Stripe**: Handles subscriptions and one-time purchases (promotion credits)
- **Controllers**: `src/controllers/paymentController.js`, `src/controllers/stripeWebhook.js`
- **Models**: Subscription, UserFeature
- Webhook endpoint: `/api/webhooks/stripe` for Stripe events

#### Analytics System
- **Cron Jobs**:
  - `src/analytics/analyticsCron.js`: Daily analytics aggregation (runs at 00:01 AM)
  - `src/cron/boostExpirationCron.js`: Manages listing promotion expiration
- **Models** (src/analytics/models/):
  - Analytics: General analytics data
  - ClickConversion: Click-through tracking
  - SearchQueryAnalytics: Search behavior analytics
- Tracks: listing views, clicks, conversions, search patterns, geographic data

#### GraphQL API
- **Location**: `src/graphql/`
- **Files**: `server.js` (Apollo Server), `schema.js`, `resolvers.js`
- **Endpoint**: `/graphql` with playground at `/playground`
- Runs alongside REST API

#### File Upload & Storage
- **Configuration**: `src/config/upload.js` creates upload directories
- **Services**:
  - `minioService.js`: Object storage (S3-compatible)
  - `rekognitionService.js`: AWS Rekognition for image analysis
- **Environment**: MinIO for object storage (local/Railway)

#### Third-Party Integrations
- **Apple Services**: `src/services/appleService.js` (Sign-In, App Store Server API)
- **Google Services**: `src/services/googleService.js` (Sign-In)
- **Amazon Advertising**: `src/services/amazonAdvertisingService.js`
- **OpenAI**: `src/services/openAi/` (embeddings, image analysis, transcription)
- **Geocoding**: `src/services/geocodingService.js` for location data

#### Middleware Pipeline
Applied in this order (see src/app.js):
1. CORS (dynamic origin validation)
2. Helmet (security headers)
3. Morgan (logging)
4. Body parsers (JSON, URL-encoded)
5. Cookie parser
6. Compression
7. `optionalAuthenticateToken` (identify user if possible)
8. `dynamicRateLimit` (stricter for guests, lenient for authenticated)

### Route Structure
All API routes are prefixed with `/api`:
- `/api/auth`: Authentication (login, register, password reset, profile)
- `/api/listings`: Listing CRUD operations
- `/api/search`: Search functionality
- `/api/payment`: Stripe payment operations
- `/api/premium`: Premium listing features
- `/api/transcribe`: Audio transcription
- `/api/feedback`: User feedback
- `/api/admin`: Admin operations
- `/api/profile-verification`: Profile verification requests
- `/api/analytics`: Analytics data
- `/api/merchant`: Merchant/top seller operations
- `/api/labs`: Experimental features

Additional routes (not under `/api`):
- `/chat`: Chat functionality
- `/auth`: Additional auth endpoints
- `/search`: Direct search endpoints
- `/graphql`: GraphQL API
- `/playground`: GraphQL Playground
- `/health`: Health check endpoint

### Environment Configuration
Key environment variables (see .env.example):
- **Database**: `DATABASE_URL` (primary), `LISTING_URL` (listings DB)
- **JWT**: `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **OpenAI**: `OPENAI_API_KEY` (for embeddings and AI features)
- **Apple**: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
- **Google**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **MinIO**: `MINIO_PUBLIC_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- **AWS**: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (for Rekognition)
- **CORS**: `CORS_ORIGINS` (comma-separated list)

### Database Schema Management
- **NEVER** use `sequelize.sync()` in production
- All schema changes must be done through migrations
- Sequelize CLI configured via `.sequelizerc`
- Migration files location: `src/db/migrations/`
- Create new migration: `npx sequelize-cli migration:generate --name migration-name`

### Vector Search Implementation
- Uses PostgreSQL pgvector extension
- HNSW (Hierarchical Navigable Small World) indexes for fast approximate nearest neighbor search
- Embeddings dimension: 1536 (OpenAI ada-002 model)
- Categories are synced on startup via `Category.updateCategoriesDatabase()`

### Real-time Features
- Socket.io server initialized in server.js
- Primary use case: Broadcasting user count updates
- Events:
  - `getUserCount`: Client requests current user count
  - `userCountUpdate`: Server broadcasts count to clients

### Error Handling
- Centralized error handler in `src/middleware/errorHandler.js`
- Custom error classes should extend base Error
- 404 handler for undefined routes
- Always returns JSON responses with `success` field

### Testing
- Jest configured for unit tests
- Supertest for API endpoint testing
- No test files currently exist - create in `__tests__/` or `*.test.js`

## Development Guidelines

### Adding New Endpoints
1. Create controller in `src/controllers/`
2. Define routes in appropriate file in `src/routes/`
3. Register route module in `src/routes/index.js`
4. Use existing middleware (`authenticateToken`, rate limiting)
5. Follow error handling pattern with try-catch and proper status codes

### Database Changes
1. Generate migration: `npx sequelize-cli migration:generate --name descriptive-name`
2. Write `up` and `down` methods in migration file
3. Test migration: `npm run migrate`
4. Test rollback: `npm run migrate:undo`
5. Update model files in `src/db/models/` if needed

### Working with Vector Search
- Embeddings are generated via `embeddingService.js`
- Use scripts to generate/update embeddings for data
- Test changes with `npm run test-vector-search`
- HNSW indexes dramatically improve query performance

### Authentication Patterns
```javascript
// For protected routes requiring authentication
const { authenticateToken } = require('../middleware/auth');
router.get('/protected', authenticateToken, controller.method);

// For routes that work better with auth but don't require it
const { optionalAuthenticateToken } = require('../middleware/auth');
router.get('/public', optionalAuthenticateToken, controller.method);
// Access via req.user (will be undefined if not authenticated)
```

### Working with Multiple Databases
- User/auth data uses primary `DATABASE_URL` connection (Sequelize)
- Listings/categories use `LISTING_URL` connection (direct Pool)
- Keep models/services separated by database
- Category and Listing models use raw `pg.Pool` instead of Sequelize

## Deployment

### Railway Deployment
- Configuration in `railway.toml`
- Resources: 512MB RAM, 0.5 CPU cores
- Automatic migrations via `postdeploy` script
- Environment variables must be set in Railway dashboard

### Production Checklist
- Set `NODE_ENV=production`
- Configure `DATABASE_URL` for production database
- Set secure `JWT_SECRET` and `REFRESH_TOKEN_SECRET`
- Configure Stripe production keys
- Set production `CORS_ORIGINS`
- Verify all cron jobs are properly scheduled
- Ensure MinIO/S3 is configured for file uploads
### Application Structure

The application follows a layered architecture pattern:

- **Entry Point**: `src/server.js` → `src/app.js` (initialization pattern)
- **Database Layer**: Sequelize ORM with PostgreSQL + pgvector for AI/ML features
- **API Layer**: Express.js with RESTful routes + GraphQL server
- **Authentication**: JWT-based auth with Apple Sign In integration
- **Payment Processing**: Stripe integration for subscriptions and credits
- **AI/ML**: OpenAI integration with vector embeddings for intelligent search

### Key Directories

```
src/
├── app.js                 # Express app configuration and initialization
├── server.js             # Server entry point with error handling
├── controllers/          # Business logic and request handlers
├── middleware/           # Auth, error handling, rate limiting
├── routes/               # REST API route definitions
├── db/                   # Database models and configuration
│   ├── models/           # Sequelize models
│   └── migrations/       # Database schema changes
├── config/               # Configuration files (database, upload, etc.)
├── analytics/            # Analytics system with models and cron jobs
├── graphql/              # GraphQL schema and resolvers
└── langchain/            # AI agent implementation
```

### Database Architecture

- **Primary DB**: PostgreSQL with Sequelize ORM
- **Vector Search**: pgvector extension for AI-powered search
- **Models**: User management, subscriptions, analytics, conversations
- **Migrations**: Versioned schema changes in `src/db/migrations/`

### API Architecture

- **REST API**: Primary API at `/api/*` endpoints
- **GraphQL**: Available at `/graphql` with playground at `/playground`
- **Authentication**: JWT tokens with optional auth middleware
- **Rate Limiting**: Dynamic limits based on user authentication status

### Key Integrations

- **Stripe**: Payment processing for subscriptions and promotion credits
- **Apple Sign In**: Authentication via Apple ID with certificate handling
- **OpenAI**: AI-powered search and chat functionality via LangChain
- **MinIO**: Object storage for file uploads
- **AWS**: Rekognition service for image processing

## Development Patterns

### Error Handling

The application uses centralized error handling:

- `middleware/errorHandler.js` for Express error handling
- Process-level handlers for uncaught exceptions and rejections
- GraphQL custom error formatting

### Authentication Flow

1. Optional authentication middleware identifies users non-blocking
2. Dynamic rate limiting based on authentication status
3. JWT tokens with refresh token support
4. Apple Sign In integration with certificate validation

### Database Patterns

- Models use Sequelize associations for relationships
- Async initialization pattern with `initializeDatabase()`
- Development: force sync, Production: alter sync
- Migrations for schema changes, seeds for data

### AI/ML Features

- Vector embeddings stored in PostgreSQL with pgvector
- LangChain agents for intelligent responses
- Real-estate and product-specific embedding generation
- HNSW indexes for optimized vector search

## Environment Configuration

Essential environment variables (see `.env.example`):

- `NODE_ENV`: development/production
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing key
- `STRIPE_SECRET_KEY`: Stripe payment processing
- `OPENAI_API_KEY`: OpenAI API access
- `APPLE_*`: Apple Sign In credentials
- `CORS_ORIGINS`: Allowed frontend domains

## Testing and Quality

### Running Single Tests

```bash
# Run specific test file
npm test -- --testPathPattern=auth

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

### Code Quality

- ESLint for code linting with `npm run lint`
- Automatic fixing with `npm run lint:fix`
- Morgan for request logging in development
- Performance monitoring for GraphQL queries

## Apple Integration Notes

The project includes Apple App Store integration:

- Certificate files in `/certificates/` directory
- Apple Sign In with JWT verification
- App Store Server API integration
- Sandbox/production environment switching

## Casing Standards

Maintain consistent casing throughout the application:

- **Title case** for names and proper nouns
- **Sentence case** for descriptions and user-facing text
- Clear font hierarchy and spacing for headers vs. details
