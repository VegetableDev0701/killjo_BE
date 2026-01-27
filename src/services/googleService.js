const { OAuth2Client } = require('google-auth-library');

class GoogleService {
    constructor() {
        this.initializeClient();
    }

    initializeClient() {
        // Initialize Google OAuth2 client
        this.client = new OAuth2Client({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
        });
    }

    /**
     * Verify Google ID token from Android/iOS apps
     * @param {string} idToken - The Google ID token to verify
     * @returns {Promise<Object>} - Verified user payload
     */
    async verifyIdToken(idToken) {
        try {
            const ticket = await this.client.verifyIdToken({
                idToken: idToken,
                audience: [
                    process.env.GOOGLE_CLIENT_ID, // Web client ID
                    process.env.GOOGLE_ANDROID_CLIENT_ID, // Android client ID
                    process.env.GOOGLE_IOS_CLIENT_ID // iOS client ID
                ].filter(Boolean) // Remove any undefined values
            });

            const payload = ticket.getPayload();
            
            if (!payload) {
                throw new Error('Invalid Google ID token payload');
            }

            // Verify the token is for the correct audience
            const validAudiences = [
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_ANDROID_CLIENT_ID,
                process.env.GOOGLE_IOS_CLIENT_ID
            ].filter(Boolean);

            if (!validAudiences.includes(payload.aud)) {
                throw new Error('Token audience mismatch');
            }

            // Return standardized user info
            return {
                googleId: payload.sub,
                email: payload.email,
                emailVerified: payload.email_verified || false,
                name: payload.name,
                givenName: payload.given_name,
                familyName: payload.family_name,
                picture: payload.picture,
                locale: payload.locale,
                // Additional Google-specific fields
                issuer: payload.iss,
                audience: payload.aud,
                issuedAt: payload.iat,
                expiresAt: payload.exp
            };
        } catch (error) {
            console.error('Google token verification failed:', error);
            throw new Error(`Google token verification failed: ${error.message}`);
        }
    }

    /**
     * Verify Google access token (alternative method)
     * @param {string} accessToken - The Google access token to verify
     * @returns {Promise<Object>} - User info from Google
     */
    async verifyAccessToken(accessToken) {
        try {
            // Set the access token
            this.client.setCredentials({ access_token: accessToken });

            // Get user info using the access token
            const userInfoResponse = await this.client.request({
                url: 'https://www.googleapis.com/oauth2/v2/userinfo'
            });

            const userInfo = userInfoResponse.data;

            if (!userInfo || !userInfo.id) {
                throw new Error('Invalid user info from Google');
            }

            return {
                googleId: userInfo.id,
                email: userInfo.email,
                emailVerified: userInfo.verified_email || false,
                name: userInfo.name,
                givenName: userInfo.given_name,
                familyName: userInfo.family_name,
                picture: userInfo.picture,
                locale: userInfo.locale
            };
        } catch (error) {
            console.error('Google access token verification failed:', error);
            throw new Error(`Google access token verification failed: ${error.message}`);
        }
    }

    /**
     * Get Google OAuth2 authorization URL
     * @param {string} state - State parameter for security
     * @returns {string} - Authorization URL
     */
    getAuthUrl(state = null) {
        const scopes = [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ];

        const authUrl = this.client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: state,
            include_granted_scopes: true
        });

        return authUrl;
    }

    /**
     * Exchange authorization code for tokens
     * @param {string} code - Authorization code from Google
     * @returns {Promise<Object>} - Tokens and user info
     */
    async exchangeCodeForTokens(code) {
        try {
            const { tokens } = await this.client.getToken(code);
            this.client.setCredentials(tokens);

            // Get user info
            const userInfo = await this.verifyAccessToken(tokens.access_token);

            return {
                tokens,
                userInfo
            };
        } catch (error) {
            console.error('Failed to exchange code for tokens:', error);
            throw new Error(`Failed to exchange authorization code: ${error.message}`);
        }
    }
}

module.exports = GoogleService;