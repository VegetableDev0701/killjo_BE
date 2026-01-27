const geocodingService = require('./geocodingService');
const ipLocationService = require('./ipLocationService');


const getUserLocation = async (req) => {
    const { location = {} } = req.body;

    if (location.latitude !== undefined && location.longitude !== undefined && location.latitude !== null && location.longitude !== null) {
        try {
            const geocodedAddress = await geocodingService.reverseGeocode(
                location.latitude,
                location.longitude
            );
            return {
                latitude: location.latitude,
                longitude: location.longitude,
                city: geocodedAddress.components.city,
                region: geocodedAddress.components.state,
                country: geocodedAddress.components?.country_code?.toUpperCase() || geocodedAddress.components?.country,
            };
        } catch (error) {
            console.error('Error in reverse geocoding:', error);
            const ip = ipLocationService.getClientIp(req);
            const ipLocation = ipLocationService.getLocation(ip) || {};

            // Return GPS coordinates with IP-based location data as fallback
            return {
                latitude: location.latitude,
                longitude: location.longitude,
                city: ipLocation.city || null,
                region: ipLocation.region || null,
                country: ipLocation.country || null,
                isFallback: true
            };
        }
    } else {
        const ip = ipLocationService.getClientIp(req);
        return ipLocationService.getLocation(ip);
    }
};

module.exports = {
    getUserLocation
};
