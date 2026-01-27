const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

// Create Apollo Server
const server = new ApolloServer({
  schema,
  context: ({ req }) => ({ req }), // Include request in context for auth
  // Add performance monitoring
  plugins: [
    {
      async requestDidStart() {
        const startTime = Date.now();
        return {
          async willSendResponse(requestContext) {
            const duration = Date.now() - startTime;
            const operation = requestContext.operationName || 'unnamed';
            console.log(`⏱️ GraphQL Query: ${operation} - ${duration}ms`);
          }
        };
      }
    }
  ],
  // Custom error handling
  formatError: (error) => {
    // Log the full error for debugging
    console.error('GraphQL Error:', error);
    
    // Return a safe error message
    return {
      message: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'An error occurred',
      code: error.extensions?.code || 'INTERNAL_SERVER_ERROR'
    };
  }
});

module.exports = server; 