# Nodo.ia Backend

Backend API for the Nodo.ia business and listing management platform.

## Features

- Business authentication system
- Team member management
- Subscription management with Stripe integration
- Listing management
- Promotion credits system
- Analytics dashboard
- Search analytics tracking

## Technology Stack

- Node.js & Express.js
- PostgreSQL with Sequelize ORM
- Stripe for payment processing
- JSON Web Tokens (JWT) for authentication
- Nodemailer for email notifications

## Getting Started

### Prerequisites

- Node.js (v16 or later recommended)
- PostgreSQL (v12 or later)
- Stripe account for payment processing

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/nodo.ia-backend.git
   cd nodo.ia-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the `.env.example` file:
   ```
   cp .env.example .env
   ```

4. Update the environment variables in the `.env` file with your configuration.

5. Set up the database:
   ```
   npx sequelize-cli db:create
   npx sequelize-cli db:migrate
   ```

6. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Business Authentication

- `POST /api/auth/business/register` - Register a new business
- `POST /api/auth/business/verify-email` - Verify business email
- `POST /api/auth/business/login` - Login
- `POST /api/auth/business/request-password-reset` - Request password reset
- `POST /api/auth/business/reset-password` - Reset password
- `GET /api/auth/business/profile` - Get business profile
- `PUT /api/auth/business/profile` - Update business profile
- `POST /api/auth/business/change-password` - Change password
- `POST /api/auth/business/logout` - Logout

### Team Management

- `POST /api/team/accept-invitation` - Accept team invitation
- `POST /api/team/invite` - Invite a team member
- `GET /api/team` - Get all team members
- `PUT /api/team/:id` - Update team member
- `DELETE /api/team/:id` - Remove team member
- `POST /api/team/:id/resend-invitation` - Resend invitation

### Subscription Management

- `GET /api/subscription/plans` - Get available plans
- `GET /api/subscription/current` - Get current subscription
- `GET /api/subscription/history` - Get subscription history
- `POST /api/subscription/checkout` - Create checkout session
- `POST /api/subscription/cancel` - Cancel subscription
- `POST /api/subscription/reactivate` - Reactivate cancelled subscription
- `POST /api/subscription/change-plan` - Change subscription plan

### Promotion Credits

- `GET /api/credits/pricing` - Get credit pricing
- `GET /api/credits/balance` - Get credit balance
- `GET /api/credits/history` - Get credit history
- `POST /api/credits/checkout` - Create credit checkout session
- `POST /api/credits/apply` - Apply credits to a listing

### Listing Management

- `GET /api/listings` - Get all listings
- `GET /api/listings/:id` - Get a single listing
- `POST /api/listings` - Create a new listing
- `PUT /api/listings/:id` - Update a listing
- `DELETE /api/listings/:id` - Delete a listing
- `POST /api/listings/:id/promote` - Apply promotion to a listing
- `GET /api/listings/:id/analytics` - Get listing analytics

### Analytics

- `GET /api/analytics/dashboard` - Get dashboard analytics
- `GET /api/analytics/listings/performance` - Get listing performance
- `GET /api/analytics/search` - Get search analytics
- `GET /api/analytics/geographic` - Get geographic analytics
- `POST /api/analytics/record/:id/:eventType` - Record listing event

### Webhooks

- `POST /api/webhooks/stripe` - Stripe webhook endpoint

## Development

### Project Structure

```
src/
├── app.js            # Express application setup
├── server.js         # Server entry point
├── controllers/      # Request handlers
├── middleware/       # Express middleware
├── routes/           # Route definitions
├── db/               # Database models and configuration
│   ├── index.js      # Database initialization
│   └── models/       # Sequelize models
└── utils/            # Utility functions
```

### Running Tests

```
npm test
```

### Linting

```
npm run lint
```

## Deployment

### Production Build

```
npm run build
```

### Start Production Server

```
npm start
```

## License

This project is proprietary and confidential.

## Contact

For any questions or support, please contact [your-email@example.com](mailto:your-email@example.com). 