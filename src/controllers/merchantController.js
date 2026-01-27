const { Merchant, User } = require('../db');
const Listing = require('../models/Listing');
const ScrappedDataService = require('../services/scrappedDataService');
const minioService = require('../services/minioService');
const amazonService = require('../services/amazonAdvertisingService');
const redisService = require('../services/redisService');
const QRCode = require('qrcode');
const sharp = require('sharp');
const path = require('path');
class MerchantController {

  async generateAndSaveQRCode(merchant) {
    try {
      if (!merchant.share_url) {
        merchant.share_url = `https://www.nodoia.app/m/${merchant.slug}`;
      }

      const qrBuffer = await QRCode.toBuffer(merchant.share_url, {
        errorCorrectionLevel: 'M',
        type: 'png',
        margin: 1,
        width: 390,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      const QR_templatePath = path.join(__dirname, `../assets/QR template.png`);

      // const logoPath = path.join(__dirname, '../assets/nodo_logo_mini_white.png');

      // const qrWithLogo = await sharp(qrBuffer)
      //   .composite([{
      //     input: logoPath,
      //     gravity: 'center',
      //     blend: 'over'
      //   }])
      //   .toBuffer();

      const finalImage = await sharp(QR_templatePath)
        .composite([{
          input: qrBuffer,
          top: 529,
          left: 518,
          blend: 'over'
        }])
        .toBuffer();

      // Create a file object for MinIO upload
      const qrFile = {
        buffer: finalImage,
        originalname: `qr-${merchant.slug}.png`,
        mimetype: 'image/png'
      };

      const uploadResult = await minioService.uploadImage(qrFile, 'merchant-qrcodes');

      await merchant.update({ qr_code_url: uploadResult.publicUrl });

      return uploadResult.publicUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  async EditMerchant(req, res) {
    try {
      const { brandName, sequence, merchantId, category, status, boost, boostExpire } = req.body;

      // Validate required fields (brandName, sequence, merchantId are required if status is not being changed)
      if (!merchantId) {
        return res.status(400).json({
          error: 'Missing required field: merchantId'
        });
      }

      // Validate merchantId
      if (typeof merchantId !== 'string' || merchantId.trim() === '') {
        return res.status(400).json({ error: 'merchantId must be a non-empty string' });
      }

      // Find the merchant
      const merchant = await Merchant.findOne({ where: { id: merchantId } });

      if (!merchant) {
        return res.status(404).json({ error: 'Merchant not found' });
      }

      // Prepare update data
      const updateData = {};

      // Validate and add brandName if provided
      if (brandName !== undefined) {
        if (typeof brandName !== 'string' || brandName.trim() === '') {
          return res.status(400).json({ error: 'brandName must be a non-empty string' });
        }
        updateData.brand_name = brandName;
      }

      // Validate and add sequence if provided
      if (sequence !== undefined) {
        // If sequence is 0, null, undefined, or empty string, set it to null
        if (sequence === null || sequence === '' || sequence === 0) {
          updateData.sequence = null;
        } else if (typeof sequence === 'string' || typeof sequence === 'number') {
          updateData.sequence = sequence;
        } else {
          return res.status(400).json({ error: 'sequence must be a string, number, null, 0, or empty string' });
        }
      }

      // Validate and add category if provided
      if (category !== undefined) {
        if (typeof category !== 'string') {
          return res.status(400).json({ error: 'category must be a string' });
        }
        updateData.category = category;
      }

      // Validate and add status if provided
      if (status !== undefined) {
        if (!['active', 'suspended'].includes(status)) {
          return res.status(400).json({
            error: 'Status must be either "active" or "suspended"'
          });
        }
        updateData.status = status;
      }

      // Validate and add boost if provided
      if (boost !== undefined) {
        if (boost === null || boost === '' || boost === 0) {
          updateData.boost = 0;
        } else if (typeof boost === 'number' || typeof boost === 'string') {
          const boostValue = parseInt(boost);
          if (isNaN(boostValue) || boostValue < 0) {
            return res.status(400).json({ error: 'boost must be a non-negative integer' });
          }
          updateData.boost = boostValue;
        } else {
          return res.status(400).json({ error: 'boost must be a number, null, 0, or empty string' });
        }
      }

      // Validate and add boostExpire if provided
      if (boostExpire !== undefined) {
        if (boostExpire === null || boostExpire === '') {
          updateData.boost_expire = null;
        } else {
          const boostDate = new Date(boostExpire);
          if (isNaN(boostDate.getTime())) {
            return res.status(400).json({ error: 'boostExpire must be a valid date or null' });
          }
          updateData.boost_expire = boostDate;
        }
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          error: 'At least one field must be provided to update: brandName, sequence, category, status, boost, or boostExpire'
        });
      }

      // Capture previous status if status is being changed
      const previousStatus = merchant.status;

      // Update merchant with new data
      await merchant.update(updateData);

      // Invalidate boosted merchants cache if boost or boostExpire was updated
      if (boost !== undefined || boostExpire !== undefined) {
        redisService.invalidateBoostedMerchantsCache().catch((err) =>
          console.error('Error invalidating boosted merchants cache:', err)
        );
      }

      // Handle status change logic if status was updated
      if (status !== undefined && status !== previousStatus) {
        await this.updateStatus(status, merchant.user_id);
      }

      res.json({
        success: true,
        message: 'Merchant updated successfully',
        data: {
          merchantId: merchant.user_id,
          brandName: merchant.brand_name,
          sequence: merchant.sequence,
          category: merchant.category,
          status: merchant.status,
          boost: merchant.boost,
          boostExpire: merchant.boost_expire,
          updatedAt: merchant.updatedAt
        }
      });

    } catch (err) {
      console.error('Error updating merchant:', err);
      res.status(500).json({ error: 'Failed to update merchant' });
    }
  };

  async updateStatus(status, userId) {
    const ScrappedDataService = require('../services/scrappedDataService');

    // Get associated user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found for this merchant' });
    }

    if (status === 'suspended') {
      // Suspending merchant - keep first 5 listings, hide rest and all scrapped products, set user to UNPAID
      try {
        const [hideResult, scrappedResult] = await Promise.all([
          Listing.hideListingsBeyondLimit(user.id, 5),
          ScrappedDataService.hideScrappedDataByUserId(user.id)
        ]);

        // Update user verification status to UNPAID
        await user.update({ verifiedStatus: 'REJECTED'});

        console.log(`Merchant suspended. Hidden ${hideResult.hidden} listings beyond first 5 and ${scrappedResult.hidden} scrapped products. User set to REJECTED.`);
      } catch (error) {
        console.error('Error hiding products during merchant suspension:', error);
        // Don't fail the merchant update, just log the error
      }
    } else if (status === 'active') {
      // Activating merchant - restore ALL listings and scrapped products, set user to VERIFIED
      try {
        const [showResult, scrappedResult] = await Promise.all([
          Listing.showAllListingsForUser(user.id),
          ScrappedDataService.showScrappedDataByUserId(user.id)
        ]);

        // Update user verification status to VERIFIED
        await user.update({ verifiedStatus: 'VERIFIED', status: 'active' });

        console.log(`Merchant activated. Restored ${showResult.restored} listings and ${scrappedResult.restored} scrapped products. User set to active and VERIFIED.`);
      } catch (error) {
        console.error('Error showing products during merchant activation:', error);
        // Don't fail the merchant update, just log the error
      }
    }
  }

  async updateMerchantLogo(req, res) {
    try {
      const userId = req.user.id
      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }

      if (!req.files || !req.files.logo || !req.files.logo[0]) {
        return res.status(400).json({ error: 'Logo image file is required.' });
      }

      const uploadResult = await minioService.uploadImage(req.files.logo[0], 'merchant-logos');

      const merchant = await Merchant.findOne({ where: { user_id: userId } });

      if (merchant?.logo_url) {
        await minioService.deleteImage(merchant.logo_url, 'merchant-logos');
      }

      if (!merchant) {
        return res.status(404).json({ error: 'Merchant not found.' });
      }
      await merchant.update({ logo_url: uploadResult.publicUrl });

      res.json({ message: 'Logo updated successfully.', logoUrl: uploadResult.publicUrl });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update merchant logo.' });
    }
  };

  async addStoreLocation(req, res) {
    try {
      const userId = req.user.id;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }

      const { latitude, longitude } = req.body;

      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'latitude and longitude are required.' });
      }

      const latNum = Number(latitude);
      const lngNum = Number(longitude);

      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return res.status(400).json({ error: 'latitude and longitude must be numbers' });
      }
      if (latNum < -90 || latNum > 90) {
        return res.status(400).json({ error: 'latitude must be between -90 and 90' });
      }
      if (lngNum < -180 || lngNum > 180) {
        return res.status(400).json({ error: 'longitude must be between -180 and 180' });
      }

      const merchant = await Merchant.findOne({ where: { user_id: userId } });
      if (!merchant) {
        return res.status(404).json({ error: 'Merchant not found.' });
      }

      await merchant.update({ latitude: latNum, longitude: lngNum });

      res.json({
        message: 'Store location saved successfully.',
        data: {
          latitude: Number(merchant.latitude),
          longitude: Number(merchant.longitude),
        }
      });
    } catch (err) {
      console.error('Error saving store location:', err);
      res.status(500).json({ error: 'Failed to save store location.' });
    }
  };

  async getAllMerchants(req, res) {
    try {
      // Optional pagination
      let page = req.query.page ? parseInt(req.query.page) : undefined;
      let limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      let skip = page && limit ? (page - 1) * limit : undefined;

      // Sorting by brand name only if brandOrder is present
      let findOptions = {
        where: {}
      };

      if (req.query.brandOrder) {
        const brandOrder = req.query.brandOrder === 'desc' ? 'DESC' : 'ASC';
        findOptions.order = [['brand_name', brandOrder]];
      }
      if (typeof skip !== 'undefined' && typeof limit !== 'undefined') {
        findOptions.offset = skip;
        findOptions.limit = limit;
      }

      let merchantStatus = 'active'; // Default status

      if (req.query.status) {
        if (req.query.status === 'all') {
          // Don't add status filter when 'all' is requested
          merchantStatus = null;
        } else if (['active', 'suspended'].includes(req.query.status)) {
          findOptions.where.status = req.query.status;
          merchantStatus = req.query.status;
        }
      } else {
        findOptions.where.status = 'active' ;
      }

      const { count: total, rows: merchants } = await Merchant.findAndCountAll(findOptions);

      // Get product counts for all merchants in parallel (optimized)
      const merchantIds = merchants.map(m => m.user_id);


      let [merchantListingMap, merchantScrappedMap] = await Promise.all([
        Listing.countListingsByUserIds(merchantIds, merchantStatus),
        ScrappedDataService.getUserIdScrappedCountMap(merchantIds, merchantStatus)
      ]);

      const merchantsWithListingCount = merchants.map(m => {
        // Check if merchant is Amazon - show 9999 products
        if (m.slug && (m.slug === 'amazon' || m.slug === 'aliexpress')) {
          return {
            ...m.toJSON ? m.toJSON() : m,
            totalListings: 9999
          };
        }

        // Regular merchants - calculate actual listings
        return {
          ...m.toJSON ? m.toJSON() : m,
          totalListings: (merchantListingMap[m.user_id] || 0) + (merchantScrappedMap[m.user_id] || 0)
        };
      });

      // Response adapts to pagination presence
      let response = {
        data: merchantsWithListingCount,
        total
      };
      if (typeof page !== 'undefined' && typeof limit !== 'undefined') {
        response.page = page;
        response.limit = limit;
        response.totalPages = Math.ceil(total / limit);
      } else {
        response.page = 1;
        response.limit = total;
        response.totalPages = 1;
      }
      res.json(response);
    } catch (err) {
      console.error('Failed to fetch merchants:', err);
      res.status(500).json({
        success: false,
        message: `Failed to fetch merchants: ${err.message}`,
        error: err.stack, // For more detailed debugging, consider sending stack in dev environment
      });
    }
  };

  async getMerchantBySlug(req, res) {
    try {
      const slug = req.params.slug;
      if (!slug) {
        return res.status(400).json({ error: 'Slug parameter is required.' });
      }

      const merchant = await Merchant.findOne({ where: { slug, status: 'active' } });

      if (!merchant) {
        return res.status(404).json({ error: 'Merchant not found' });
      }

      // Check if merchant is Amazon or AliExpress - show 9999 products
      if (merchant.slug && (merchant.slug === 'amazon' || merchant.slug === 'aliexpress')) {
        merchant.totalListings = 9999;
      } else {
        // Regular merchants - calculate actual listings
        let [merchantListingMap, merchantScrappedMap] = await Promise.all([
          Listing.countListingsByUserIds([merchant.user_id], 'active'),
          ScrappedDataService.getUserIdScrappedCountMap([merchant.user_id], 'active')
        ]);

        merchant.totalListings = (merchantListingMap[merchant.user_id] || 0) + (merchantScrappedMap[merchant.user_id] || 0);
      }

      res.json({
        data: merchant,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch merchant from slug' });
    }
  };

  async getMerchantById(req, res) {
    try {
      const merchantId = req.params.id;
      
      if (!merchantId) {
        return res.status(400).json({ error: 'Merchant ID is required.' });
      }

      const merchant = await Merchant.findOne({ 
        where: { user_id: merchantId, status: 'active' } 
      });

      if (!merchant) {
        return res.status(404).json({ error: 'Merchant not found' });
      }

      // Build response with merchant details
      const merchantData = {
        id: merchant.id,
        user_id: merchant.user_id,
        brand_name: merchant.brand_name,
        logo_url: merchant.logo_url,
        slug: merchant.slug,
        category: merchant.category,
        status: merchant.status,
        share_url: merchant.share_url,
        qr_code_url: merchant.qr_code_url,
        location: {
          latitude: merchant.latitude ? Number(merchant.latitude) : null,
          longitude: merchant.longitude ? Number(merchant.longitude) : null
        },
        createdAt: merchant.createdAt,
        updatedAt: merchant.updatedAt
      };

      // Check if merchant is Amazon or AliExpress - show 9999 products
      if (merchant.slug && (merchant.slug === 'amazon' || merchant.slug === 'aliexpress')) {
        merchantData.totalListings = 9999;
      } else {
        // Regular merchants - calculate actual listings
        let [merchantListingMap, merchantScrappedMap] = await Promise.all([
          Listing.countListingsByUserIds([merchant.user_id], 'active'),
          ScrappedDataService.getUserIdScrappedCountMap([merchant.user_id], 'active')
        ]);

        merchantData.totalListings = (merchantListingMap[merchant.user_id] || 0) + (merchantScrappedMap[merchant.user_id] || 0);
      }

      res.json({
        success: true,
        data: merchantData
      });
    } catch (err) {
      console.error('Error fetching merchant by ID:', err);
      res.status(500).json({ error: 'Failed to fetch merchant details' });
    }
  };

  async getTopMerchants(req, res) {
  try {
    // Get all active merchants
    const merchants = await Merchant.findAll({
      where: { status: 'active' }
    });

    const now = new Date();
    const boostedMerchants = [];
    const sequencedMerchants = [];

    merchants.forEach(merchant => {
      const isBoosted =
        merchant.boost > 0 &&
        merchant.boost_expire &&
        new Date(merchant.boost_expire) > now;

      const hasSequence =
        merchant.sequence &&
        merchant.sequence !== null &&
        merchant.sequence > 0;

      if (isBoosted) {
        boostedMerchants.push(merchant);
      } else if (hasSequence) {
        sequencedMerchants.push(merchant);
      } 
    });

    // Sort boosted merchants: latest expiry first
    boostedMerchants.sort((a, b) =>
      new Date(b.boost_expire) - new Date(a.boost_expire)
    );

    // Sort sequenced merchants: sequence ASC
    sequencedMerchants.sort((a, b) => a.sequence - b.sequence);
    const topMerchants = [
      ...boostedMerchants,
      ...sequencedMerchants
    ];

    // Add totalListings for each merchant
    const userIds = topMerchants.map(m => m.user_id);
    const [merchantListingMap, merchantScrappedMap] = await Promise.all([
      Listing.countListingsByUserIds(userIds, 'active'),
      ScrappedDataService.getUserIdScrappedCountMap(userIds, 'active')
    ]);

    const topMerchantsWithListings = topMerchants.map(merchant => {
      // Check if merchant is Amazon or AliExpress - show 9999 products
      if (merchant.slug && (merchant.slug === 'amazon' || merchant.slug === 'aliexpress')) {
        return {
          ...merchant.get(),
          totalListings: 9999
        };
      }
      
      // Regular merchants - calculate actual listings
      const totalListings = 
        (merchantListingMap[merchant.user_id] || 0) + 
        (merchantScrappedMap[merchant.user_id] || 0);
      
      return {
        ...merchant.get(),
        totalListings
      };
    });

    res.json({
      success: true,
      data: topMerchantsWithListings,
      message: 'Top merchants fetched successfully'
    });

  } catch (err) {
    console.error('Error fetching top merchants:', err);
    res.status(500).json({ error: 'Failed to fetch top merchants' });
  }
};


  async getMerchantProducts(req, res) {
    try {
      const userId = req.params.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const category = req.query.category || null; // Optional category filter

      // First, get the merchant to check their brand name
      const merchant = await Merchant.findOne({ where: { user_id: userId } });

      if (!merchant) {
        return res.status(404).json({ error: 'Merchant not found' });
      }

      // Check if merchant brand name is 'Amazon'
      if (merchant.slug && merchant.slug === 'amazon') {
        try {
          // Return Amazon products instead of database products
          const amazonProducts = await this.getAmazonProducts(category, limit, page, userId);

          return res.json({
            data: {
              scrapped: amazonProducts,
              listings: []
            },
            page,
            limit,
            total: 9999,
            totalPages: 100, // Amazon API doesn't provide total count
            source: 'amazon',
            merchant: {
              brand_name: merchant.brand_name,
              name: merchant.name,
              slug: merchant.slug
            }
          });
        } catch (amazonError) {
          console.error('Amazon API error for merchant:', amazonError);
          // Fall back to regular database query if Amazon API fails
        }
      }

      // Get user's verification status to determine product visibility
      const user = await User.findByPk(userId);
      const userVerifiedStatus = user ? user.verifiedStatus : null;

      // Regular database query for non-Amazon merchants or Amazon API fallback
      const [listingCount, listings, scrappedRes] = await Promise.all([
        Listing.countListingByUserId(userId, userVerifiedStatus),
        Listing.findByUserId(userId, limit, offset, userVerifiedStatus),
        ScrappedDataService.getScrappedDataByUserId(userId, merchant.status)
      ]);

      const total = listingCount + scrappedRes.length;

      const needFromScrapped = limit - listings.length;

      let scrappedData = [];
      if (needFromScrapped > 0 && scrappedRes.length > 0) {
        const scrappedOffset = Math.max(0, offset - listingCount);
        const scrappedToTake = Math.min(needFromScrapped, scrappedRes.length - scrappedOffset);
        scrappedData.push(...scrappedRes.slice(scrappedOffset, scrappedOffset + scrappedToTake));
      }

      res.json({
        data: {
          listings: listings,
          scrapped: scrappedData
        },
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        source: 'database',
        merchant: {
          brand_name: merchant.brand_name,
          name: merchant.name,
          slug: merchant.slug
        }
      });
    } catch (err) {
      console.error('Error in getMerchantProducts:', err);
      res.status(500).json({ error: 'Failed to fetch user listings' });
    }
  }

  /**
   * Get Amazon products for merchant with smart pagination algorithm
   * @param {string} category - Product category (ignored - we rotate all categories)
   * @param {number} limit - Number of products per page
   * @param {number} page - Page number
   * @param {string} merchantUserId - Merchant's user ID
   * @returns {Array} - Amazon products
   */
  async getMerchantsWithBoostedProducts(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      // Try to get cached data first
      const cachedData = await redisService.getCachedBoostedMerchants();
      if (cachedData) {
        // Apply pagination to cached data
        const paginatedData = cachedData.slice(offset, offset + limit);
        return res.json({
          success: true,
          data: paginatedData,
          pagination: {
            limit,
            offset,
            count: paginatedData.length,
            total: cachedData.length,
          },
          cached: true,
        });
      }

      const allBoostedListings = await Listing.getBoostedListings();

      if (!allBoostedListings || allBoostedListings.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { limit, offset, count: 0, total: 0 },
        });
      }

      // OPTIMIZATION 2: Group by User ID and calculate sort metrics in memory
      // This allows us to sort/paginate IDs *before* fetching heavy merchant/user profiles
      const merchantMap = new Map();

      for (const listing of allBoostedListings) {
        const uid = listing.user_id;
        if (!merchantMap.has(uid)) {
          merchantMap.set(uid, {
            user_id: uid,
            products: [],
            latestBoost: 0,
          });
        }

        const entry = merchantMap.get(uid);
        entry.products.push(listing);

        // Track max date for sorting
        const expireTime = new Date(listing.boost_expire).getTime();
        if (expireTime > entry.latestBoost) {
          entry.latestBoost = expireTime;
        }
      }

      // Sort users by their latest boosted product
      const sortedMerchantGroups = Array.from(merchantMap.values()).sort(
        (a, b) => b.latestBoost - a.latestBoost
      );

      const total = sortedMerchantGroups.length;

      // If no results
      if (total === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { limit, offset, count: 0, total: 0 },
        });
      }

      // Fetch ALL merchant details for caching (not just paginated)
      const allUserIds = sortedMerchantGroups.map((g) => g.user_id);
      const merchants = await Merchant.findAll({
        where: {
          user_id: allUserIds,
          status: "active",
        },
      });

      const foundMerchantUserIds = new Set(merchants.map((m) => m.user_id));
      const missingMerchantUserIds = allUserIds.filter(
        (id) => !foundMerchantUserIds.has(id)
      );

      // Fetch fallback users for all missing merchants
      let usersAsMerchants = [];
      if (missingMerchantUserIds.length > 0) {
        const users = await User.findAll({
          where: { id: missingMerchantUserIds },
          attributes: [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "metadata",
            "createdAt",
            "updatedAt",
          ],
        });

        usersAsMerchants = users.map((user) => ({
          id: user.id,
          user_id: user.id,
          brand_name:
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            user.email,
          logo_url: user.metadata?.image || null,
          slug: null,
          category: null,
          status: "active",
          share_url: null,
          qr_code_url: null,
          latitude: user.metadata?.location?.latitude || null,
          longitude: user.metadata?.location?.longitude || null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          isFromUser: true,
        }));
      }

      // Create a lookup for all merchant details
      const merchantDetailsMap = new Map();
      merchants.forEach((m) =>
        merchantDetailsMap.set(m.user_id, { ...m.get(), isFromUser: false })
      );
      usersAsMerchants.forEach((u) => merchantDetailsMap.set(u.user_id, u));

      // Build complete dataset with all merchants
      const allResultData = sortedMerchantGroups
        .map((group) => {
          const details = merchantDetailsMap.get(group.user_id);
          if (!details) return null;

          return {
            merchant: {
              id: details.id,
              user_id: details.user_id,
              brand_name: details.brand_name,
              logo_url: details.logo_url,
              slug: details.slug,
              category: details.category,
              status: details.status,
              share_url: details.share_url,
              qr_code_url: details.qr_code_url,
              location: {
                latitude: details.latitude ? Number(details.latitude) : null,
                longitude: details.longitude ? Number(details.longitude) : null,
              },
              createdAt: details.createdAt,
              updatedAt: details.updatedAt,
              isFromUser: details.isFromUser,
            },
            boostedProducts: group.products,
            boostedProductsCount: group.products.length,
          };
        })
        .filter(Boolean);

      // Cache full dataset asynchronously (don't await)
      redisService.cacheBoostedMerchants(allResultData, 10).catch((err) =>
        console.error('Error caching boosted merchants:', err)
      );

      // Apply pagination for response
      const resultData = allResultData.slice(offset, offset + limit);

      res.json({
        success: true,
        data: resultData,
        pagination: {
          limit,
          offset,
          count: resultData.length,
          total,
        },
        cached: false,
      });
    } catch (error) {
      console.error("Error fetching merchants with boosted products:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch merchants with boosted products",
      });
    }
  }

  async getAmazonProducts(category, limit, page, merchantUserId = null) {
    try {
      // All available categories for rotation
      const predefinedCategories = ['electronics', 'fashion', 'furniture', 'books', 'sports', 'musical_instruments', 'pets', 'health', 'tools', 'foods', 'vehicles'];

      // Category mapping for Amazon search
      const categoryMapping = {
        'electronics': 'Electronics',
        'fashion': 'Fashion',
        'furniture': 'HomeAndKitchen',
        'books': 'Books',
        'sports': 'SportsAndOutdoors',
        'musical_instruments': 'MusicalInstruments',
        'pets': 'PetSupplies',
        'health': 'HealthAndHousehold',
        'tools': 'ToolsAndHomeImprovement',
        'foods': 'GroceryAndGourmetFood',
        'vehicles': 'Automotive'
      };

      // Keywords per category - more variety for better rotation
      const categoryKeywords = {
        'electronics': ['laptop', 'smartphone', 'tablet', 'headphones', 'camera', 'smartwatch', 'speaker', 'keyboard', 'mouse', 'monitor', 'charger', 'cable', 'gaming'],
        'fashion': ['shoes', 'dress', 'shirt', 'bag', 'watch', 'jeans', 'jacket', 'sunglasses', 'hat', 'belt', 'scarf', 'jewelry', 'socks'],
        'furniture': ['chair', 'table', 'lamp', 'sofa', 'bed', 'desk', 'shelf', 'mirror', 'curtain', 'pillow', 'rug', 'storage', 'decor'],
        'books': ['novel', 'textbook', 'cookbook', 'biography', 'fiction', 'mystery', 'romance', 'history', 'science', 'art', 'travel', 'health', 'business'],
        'sports': ['fitness', 'yoga', 'running', 'cycling', 'gym', 'basketball', 'football', 'tennis', 'swimming', 'hiking', 'camping', 'golf', 'boxing'],
        'musical_instruments': ['guitar', 'piano', 'drum', 'violin', 'keyboard', 'microphone', 'amplifier', 'ukulele', 'bass', 'flute', 'saxophone', 'harmonica', 'recorder'],
        'pets': ['dog food', 'cat toys', 'pet bed', 'aquarium', 'leash', 'litter', 'cage', 'carrier', 'treats', 'collar', 'bowl', 'grooming', 'training'],
        'health': ['vitamins', 'supplements', 'skincare', 'makeup', 'protein', 'cream', 'shampoo', 'toothbrush', 'medicine', 'tracker', 'thermometer', 'bandage', 'sanitizer'],
        'tools': ['drill', 'hammer', 'saw', 'screwdriver', 'wrench', 'pliers', 'tape', 'level', 'toolbox', 'nails', 'screws', 'glue', 'sandpaper'],
        'foods': ['snacks', 'coffee', 'tea', 'chocolate', 'nuts', 'cereals', 'pasta', 'sauce', 'spices', 'honey', 'oil', 'vinegar', 'flour'],
        'vehicles': ['accessories', 'parts', 'care', 'holder', 'cam', 'charger', 'covers', 'mats', 'wax', 'cleaner', 'polish', 'tools', 'emergency']
      };

      // SMART ALGORITHM: No product repetition across pages
      const productsPerCategory = 5; // Fixed: 5 products per category
      const totalCategoriesNeeded = Math.ceil(limit / productsPerCategory);

      // Calculate which categories to use for this page
      const startCategoryIndex = ((page - 1) * totalCategoriesNeeded) % predefinedCategories.length;
      const categoriesToFetch = [];

      for (let i = 0; i < totalCategoriesNeeded; i++) {
        const categoryIndex = (startCategoryIndex + i) % predefinedCategories.length;
        categoriesToFetch.push(predefinedCategories[categoryIndex]);
      }

      console.log(`Page ${page}: Fetching categories:`, categoriesToFetch);

      const allProducts = [];

      // Fetch products from each selected category
      for (let i = 0; i < categoriesToFetch.length; i++) {
        const currentCategory = categoriesToFetch[i];
        const keywords = categoryKeywords[currentCategory] || ['popular'];

        // Calculate keyword rotation to avoid same products within category
        const keywordRotationIndex = Math.floor(((page - 1) * totalCategoriesNeeded + i) / predefinedCategories.length);
        const selectedKeyword = keywords[keywordRotationIndex % keywords.length];

        // Calculate Amazon page to avoid repetition within same category/keyword combo
        const amazonPage = Math.floor(keywordRotationIndex / keywords.length) + 1;

        console.log(`Category: ${currentCategory}, Keyword: ${selectedKeyword}, Amazon Page: ${amazonPage}`);

        try {
          const searchOptions = {
            itemCount: Math.min(productsPerCategory, 10), // Max 5 per category, Amazon API max is 10
            itemPage: amazonPage,
            searchIndex: categoryMapping[currentCategory] || 'All'
          };

          const categoryProducts = await amazonService.searchProducts(
            selectedKeyword,
            searchOptions,
            currentCategory,
            merchantUserId
          );

          // Take only the number of products we need
          const productsToAdd = Math.min(categoryProducts.length, productsPerCategory);
          const remainingSlots = limit - allProducts.length;
          const finalProductsToAdd = Math.min(productsToAdd, remainingSlots);

          allProducts.push(...categoryProducts.slice(0, finalProductsToAdd));

          // Stop if we have enough products
          if (allProducts.length >= limit) {
            break;
          }

        } catch (error) {
          console.error(`Error fetching products for category ${currentCategory}:`, error.message);
          // Continue with next category if one fails
        }
      }

      console.log(`Page ${page}: Returning ${allProducts.length} products`);
      return allProducts;

    } catch (error) {
      console.error('Error in getAmazonProducts:', error);
      throw error;
    }
  }



}

module.exports = new MerchantController();

