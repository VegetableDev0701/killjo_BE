const geoip = require('geoip-lite');

class IpLocationService {
    /**
     * Get location data from IP address
     * @param {string} ip - IP address
     * @returns {Object|null} Location data { city, region, country, ll, ... }
     */
    getLocation(ip) {
        if (!ip) return null;

        // Handle localhost/private IPs
        if (ip === '127.0.0.1' || ip === '::1') {
            return null;
        }

        try {
            const geo = geoip.lookup(ip);
            if (!geo) return null;

            // Return only city, region (province), and country
            return {
                city: geo.city,
                region: geo.region,
                country: geo.country
            };
        } catch (error) {
            console.error('Error resolving IP location:', error);
            return null;
        }
    }

    /**
     * Extract IP from Express request
     * @param {Object} req - Express request object
     * @returns {string} IP address
     */
    getClientIp(req) {
        const ip = req.headers['cf-connecting-ip'] ||
            req.headers['x-real-ip'] ||
            req.headers['x-client-ip'] ||
            (req.headers['x-forwarded-for'] || '').split(',')[0] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket?.remoteAddress;

        return ip ? ip.trim() : null;
    }
}

module.exports = new IpLocationService();
