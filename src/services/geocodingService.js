const axios = require('axios');

class GeocodingService {
  constructor() {
    this.baseUrl = 'https://nominatim.openstreetmap.org';
    this.userAgent = 'NodoApp/1.0 (https://github.com/nodo-app)';
  }

  /**
   * Reverse geocode coordinates to get address information
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} zoom - Zoom level (0-18, default 16 for optimal detail)
   * @returns {Promise<Object>} Address information
   */
  async reverseGeocode(lat, lng, zoom = 16, language = 'en') {
    try { 
        
      const url = `${this.baseUrl}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1&accept-language=${language}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          'Accept-Language': language
        },
        timeout: 10000
      });

      const data = response.data;
      
      if (data.error) {
        throw new Error(`Nominatim error: ${data.error}`);
      }

      return this.formatAddress(data);
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }

  /**
   * Forward geocode address to get coordinates
   * @param {string} query - Address query
   * @param {string} countryCode - Country code (e.g., 'do' for Dominican Republic)
   * @returns {Promise<Object>} Coordinates and address information
   */
  async forwardGeocode(query, countryCode = 'do', language = 'en') {
    try {
      const url = `${this.baseUrl}/search?format=json&q=${encodeURIComponent(query)}&countrycodes=${countryCode}&limit=1&accept-language=${language}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          'Accept-Language': language
        },
        timeout: 10000
      });

      const data = response.data;
      
      if (!data || data.length === 0) {
        throw new Error('No results found');
      }

      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name,
        address: data[0].address,
        importance: data[0].importance
      };
    } catch (error) {
      console.error('Forward geocoding error:', error);
      throw error;
    }
  }

  /**
   * Format the address data from Nominatim response
   * @param {Object} data - Raw Nominatim response
   * @returns {Object} Formatted address
   */
  formatAddress(data) {
    const address = data.address || {};
    
    return {
      coordinates: {
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon)
      },
      display_name: this.buildCleanDisplayName(address),
      formatted_address: this.buildFormattedAddress(address),
      components: {
        country: address.country,
        state: address.state || address.province,
        city: address.city || address.town || address.village,
        district: address.district || address.suburb,
        neighborhood: address.neighbourhood,
        street: address.road,
        house_number: address.house_number,
        postcode: address.postcode
      },
      raw: address
    };
  }

  /**
   * Build a clean display name (up to state level, excluding country)
   * @param {Object} address - Address components
   * @returns {string} Clean display name
   */
  buildCleanDisplayName(address) {
    const parts = [];
    
    // Add street if available
    if (address.road) {
      parts.push(address.road);
    }
    
    // Add neighborhood if available
    if (address.neighbourhood) {
      parts.push(address.neighbourhood);
    }
    
    // Add district/suburb if available
    if (address.district || address.suburb) {
      parts.push(address.district || address.suburb);
    }
    
    // Add city/town/village
    if (address.city || address.town || address.village) {
      parts.push(address.city || address.town || address.village);
    }
    
    // Add state/province
    if (address.state || address.province) {
      parts.push(address.state || address.province);
    }
    
    return parts.join(', ');
  }

  /**
   * Build a formatted address string
   * @param {Object} address - Address components
   * @returns {string} Formatted address
   */
  buildFormattedAddress(address) {
    const parts = [];
    
    if (address.house_number) parts.push(address.house_number);
    if (address.road) parts.push(address.road);
    if (address.neighbourhood) parts.push(address.neighbourhood);
    if (address.district) parts.push(address.district);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.country) parts.push(address.country);
    
    return parts.join(', ');
  }

  /**
   * Validate coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {boolean} True if valid
   */
  validateCoordinates(lat, lng) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /**
   * Get geocoding service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      service: 'OpenStreetMap Nominatim',
      baseUrl: this.baseUrl,
      userAgent: this.userAgent,
      status: 'available'
    };
  }
}

module.exports = new GeocodingService(); 