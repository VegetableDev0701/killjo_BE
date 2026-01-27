const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { promisify } = require('util');

// Apple JWT verification client
const client = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

// Promisify the getSigningKey function
const getSigningKey = promisify((kid, callback) => {
  client.getSigningKey(kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
});

// Dynamic import for node-fetch
let fetch = null;

async function getFetch() {
  if (!fetch) {
    try {
      const fetchModule = await import('node-fetch');
      fetch = fetchModule.default;
    } catch (error) {
      console.error('Failed to load node-fetch:', error);
      throw new Error('Failed to load fetch module');
    }
  }
  return fetch;
}

/**
 * Verify the Apple ID token
 * @param {string} idToken - The Apple ID token to verify
 * @returns {Promise<object>} - The decoded token payload
 */
async function verifyAppleToken(idToken) {
  try {
    // Get the kid (Key ID) from the token header
    const decoded = jwt.decode(idToken, { complete: true });
    
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new Error('Invalid token format');
    }
    
    // Get the signing key
    const signingKey = await getSigningKey(decoded.header.kid);
    
    // Verify and decode the token
    const verifiedToken = jwt.verify(idToken, signingKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: process.env.APPLE_CLIENT_ID, // Must match your app's client ID
    });
    
    return verifiedToken;
  } catch (error) {
    console.error('Apple token verification failed:', error);
    throw new Error(`Apple token verification failed: ${error.message}`);
  }
}

/**
 * Exchange Apple authorization code for tokens
 * @param {string} authorizationCode - The authorization code from Apple
 * @returns {Promise<object>} - The tokens from Apple
 */
async function exchangeAppleCodeForTokens(authorizationCode) {
  try {
    const clientSecret = generateAppleClientSecret();
    const fetch = await getFetch();
    
    const response = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
        redirect_uri: process.env.APPLE_REDIRECT_URI,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Apple token exchange failed: ${JSON.stringify(errorData)}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Apple code exchange failed:', error);
    throw new Error(`Apple code exchange failed: ${error.message}`);
  }
}

/**
 * Generate the client secret for Apple Sign In
 * This is a JWT signed with your private key
 * @returns {string} - The client secret JWT
 */
function generateAppleClientSecret() {
  const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  
  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '1h',
    audience: 'https://appleid.apple.com',
    issuer: process.env.APPLE_TEAM_ID,
    subject: process.env.APPLE_CLIENT_ID,
    keyid: process.env.APPLE_KEY_ID,
  });
  
  return token;
}

module.exports = {
  verifyAppleToken,
  exchangeAppleCodeForTokens,
}; 