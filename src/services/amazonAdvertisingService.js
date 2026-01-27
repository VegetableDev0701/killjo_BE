const ProductAdvertisingAPIv1 = require('paapi5-nodejs-sdk');
const logger = require('../utils/logger');

/**
 * Amazon Product Advertising API Service
 * Handles fetching product data from Amazon PA API for merchant integration
 */
class AmazonAdvertisingService {
  constructor() {
    // API Credentials
    this.accessKey = 'AKPAYPFWZ61758813657';
    this.secretKey = 'Tj8pQm40ud39Ou0ZA4ShqUXnbYBpkL60oUzaTX0T';
    this.partnerTag = 'nodoia-20';
    
    // API Configuration
    this.region = 'us-east-1';
    this.host = 'webservices.amazon.com';
    
    // Initialize API client
    const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
    defaultClient.accessKey = this.accessKey;
    defaultClient.secretKey = this.secretKey;
    defaultClient.host = this.host;
    defaultClient.region = this.region;
    
    this.api = new ProductAdvertisingAPIv1.DefaultApi();
  }

  /**
   * Search for products
   * @param {string} keywords - Search keywords
   * @param {Object} options - Search options
   * @param {string} customCategory - Custom category for formatting
   * @param {string} merchantUserId - Merchant's user ID for the products
   * @returns {Promise<Array>} - Array of formatted products
   */
  async searchProducts(keywords, options = {}, customCategory = null, merchantUserId = null) {
    try {
      const {
        itemCount = 10,
        itemPage = 1,
        searchIndex = 'All',
        minPrice,
        maxPrice,
        brand,
        condition = 'New'
      } = options;

      // Create search request
      const searchItemsRequest = new ProductAdvertisingAPIv1.SearchItemsRequest();
      searchItemsRequest['PartnerTag'] = this.partnerTag;
      searchItemsRequest['PartnerType'] = 'Associates';
      searchItemsRequest['Keywords'] = keywords;
      searchItemsRequest['SearchIndex'] = searchIndex;
      searchItemsRequest['ItemCount'] = itemCount;
      searchItemsRequest['ItemPage'] = itemPage;
      
      // Add resources - only use confirmed valid resources
      searchItemsRequest['Resources'] = [
        'Images.Primary.Large',
        'Images.Primary.Medium',
        'Images.Primary.Small',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ByLineInfo',
        'ItemInfo.Classifications',
        'Offers.Listings.Price'
      ];

      // Optional filters
      if (minPrice) searchItemsRequest['MinPrice'] = minPrice;
      if (maxPrice) searchItemsRequest['MaxPrice'] = maxPrice;
      if (brand) searchItemsRequest['Brand'] = brand;
      if (condition) searchItemsRequest['Condition'] = condition;

      // Execute search
      const response = await new Promise((resolve, reject) => {
        this.api.searchItems(searchItemsRequest, (error, data) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      });

      // Store merchant user ID for formatting
      this.merchantUserId = merchantUserId;
      return this._formatSearchResults(response, customCategory);
    } catch (error) {
      logger.error('Error searching Amazon products:', error);
      
      // Extract error message
      const errorMsg = error.response?.text || error.message || 'Unknown error';
      let parsedError = errorMsg;
      
      try {
        const errorData = JSON.parse(errorMsg);
        parsedError = errorData.Errors?.[0]?.Message || errorMsg;
      } catch (e) {
        // Use original error message
      }
      
      throw new Error(`Amazon API Error: ${parsedError}`);
    }
  }

  /**
   * Format search results
   * @param {Object} data - Raw Amazon API response
   * @param {string} customCategory - Custom category for formatting
   * @returns {Array} - Formatted products
   */



  /**
   * Format search results to our standard format
   * @param {Object} data - Raw API response
   * @param {string} customCategory - Your custom category
   * @returns {Array} - Formatted products
   */
  _formatSearchResults(data, customCategory = null) {
    if (!data || !data.SearchResult || !data.SearchResult.Items) {
      return [];
    }

    return data.SearchResult.Items.map(item => this._formatProduct(item, customCategory));
  }



  /**
   * Format single product to match your data structure
   * @param {Object} item - Raw product item from Amazon
   * @param {string} customCategory - Your custom category (optional)
   * @returns {Object} - Formatted product matching your structure
   */
  _formatProduct(item, customCategory = null) {
    const { v4: uuidv4 } = require('uuid');
    const itemInfo = item.ItemInfo || {};
    const offers = item.Offers || {};
    const images = item.Images || {};

    // Extract price information
    const listing = offers.Listings?.[0];
    const price = listing?.Price;
    const lowestPrice = offers.Summaries?.[0]?.LowestPrice;

    // Get price amount - Amazon returns actual price, not in cents
    const priceAmount = price?.Amount || lowestPrice?.Amount;
    const finalPrice = priceAmount ? Math.round(priceAmount) : 0;

    // Extract features/description
    const features = itemInfo.Features?.DisplayValues || [];
    const description = features.join('. ') || itemInfo.Title?.DisplayValue || '';

    // Extract brand
    const brand = itemInfo.ByLineInfo?.Brand?.DisplayValue || 
                 itemInfo.ByLineInfo?.Manufacturer?.DisplayValue || 
                 'Unknown';

    // Extract images - convert to array format
    const mediaUrls = [];
    if (images.Primary?.Large?.URL) mediaUrls.push(images.Primary.Large.URL);
    if (images.Primary?.Medium?.URL && !mediaUrls.includes(images.Primary.Medium.URL)) {
      mediaUrls.push(images.Primary.Medium.URL);
    }
    if (images.Primary?.Small?.URL && !mediaUrls.includes(images.Primary.Small.URL)) {
      mediaUrls.push(images.Primary.Small.URL);
    }

    // Build comprehensive attributes object - put all features here
    const attributes = {};
    
    // Core product attributes
    if (brand) attributes.brand = brand;
    
    if (itemInfo.Color?.DisplayValue) {
      attributes.color = itemInfo.Color.DisplayValue;
    }
    
    if (itemInfo.Model?.DisplayValue) {
      attributes.model = itemInfo.Model.DisplayValue;
    }
    
    if (itemInfo.Size?.DisplayValue) {
      attributes.size = itemInfo.Size.DisplayValue;
    }

    // Amazon-specific attributes
    if (item.ASIN) {
      attributes.asin = item.ASIN;
    }

    if (item.ParentASIN) {
      attributes.parent_asin = item.ParentASIN;
    }

    const amazonCategory = itemInfo.Classifications?.ProductGroup?.DisplayValue || 
                          itemInfo.Classifications?.Binding?.DisplayValue;
    if (amazonCategory) {
      attributes.amazon_category = amazonCategory;
    }
    
    // Always set condition for Amazon products
    attributes.condition = 'new';
    
    // Add availability info if available
    if (listing?.Availability?.Message) {
      attributes.availability = listing.Availability.Message;
    }

    // Add price display format
    if (price?.DisplayAmount || lowestPrice?.DisplayAmount) {
      attributes.price_display = price?.DisplayAmount || lowestPrice?.DisplayAmount;
    }

    // Add manufacturer if different from brand
    if (itemInfo.ByLineInfo?.Manufacturer?.DisplayValue && 
        itemInfo.ByLineInfo?.Manufacturer?.DisplayValue !== brand) {
      attributes.manufacturer = itemInfo.ByLineInfo.Manufacturer.DisplayValue;
    }

    // Add any other available attributes
    if (itemInfo.ProductInfo?.UnitCount?.DisplayValue) {
      attributes.unit_count = itemInfo.ProductInfo.UnitCount.DisplayValue;
    }

    if (itemInfo.TechnicalInfo?.Formats?.DisplayValues?.length > 0) {
      attributes.formats = itemInfo.TechnicalInfo.Formats.DisplayValues;
    }

    // Return in your exact format
    return {
      id: uuidv4(), // Generate UUID instead of using ASIN
      user_id: this.merchantUserId || null, // Use merchant's user_id if available
      category: customCategory || 'general', // Use passed category or default to general
      title: itemInfo.Title?.DisplayValue || 'Amazon Product',
      description: description.substring(0, 500), // Limit description length
      price: finalPrice,
      details_url: item.DetailPageURL || null, // Amazon product page URL
      media: mediaUrls,
      attributes: attributes, // All product features go here
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_verified: false // Always false for Amazon products
    };
  }
}

module.exports = new AmazonAdvertisingService();
