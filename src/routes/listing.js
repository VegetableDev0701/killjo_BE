const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const router = express.Router();
const unifiedListingService = require('../services/listingService.js');
const geocodingService = require('../services/geocodingService.js');
const ImageAnalysisService = require('../services/openAi/imageAnalysisService.js');
const {
  optionalAuthenticateToken,
  authenticateToken,
  authenticateUserOrAdmin
} = require('../middleware/auth');
const { User, Admin, sequelize } = require('../db');
router.use(optionalAuthenticateToken);

// Helper function to exclude vector fields from listing responses
function excludeVectorFields(listing) {
  if (!listing) return listing;

  const { vector, embedding_en, embedding_es, ...cleanListing } = listing;

  return cleanListing;
}

function excludeVectorFieldsFromArray(listings) {
  if (!Array.isArray(listings)) return listings;
  return listings.map(excludeVectorFields);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Flexible upload middleware for autofill endpoint
const autofillUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
}).fields([
  { name: 'file', maxCount: 1 }
]);

router.post('/listings', authenticateUserOrAdmin, upload.array('images', 10), async (req, res) => {
  console.log(req.body, 'req.body');
  try {
    const isAdmin = Boolean(req.admin);
    const resolvedUserId = isAdmin ? req.body.user_id || req.query.user_id : req.user?.id;

    if (!resolvedUserId) {
      return res.status(400).json({
        success: false,
        error: isAdmin
          ? 'user_id is required when admin creates a listing'
          : 'Authenticated user not found'
      });
    }

    const listingData = {
      user_id: resolvedUserId,
      category: req.body.category,
      title: req.body.title,
      description: req.body.description,
      price: parseFloat(req.body.price) || null,
      phone_number: req.body.phone_number,
      location: req.body.location ? JSON.parse(req.body.location) : null,
      basic_attributes: req.body.basic_attributes ? JSON.parse(req.body.basic_attributes) : {},
      attributes: req.body.attributes ? JSON.parse(req.body.attributes) : {}
    };

    const listing = await unifiedListingService.createListing(listingData, req.files, { isAdmin });

    res.status(201).json({
      success: true,
      data: listing
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get listings by user (requires auth - gets own listings)
router.get('/listings/my', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const listings = await unifiedListingService.getListingsByUser(
      req.user.id,
      parseInt(limit),
      parseInt(offset)
    );

    const cleanListings = excludeVectorFieldsFromArray(listings);

    res.json({
      success: true,
      data: cleanListings,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: cleanListings.length
      }
    });
  } catch (error) {
    console.error('Get user listings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get listings by category (public)
router.get('/listings/category/:category', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const listings = await unifiedListingService.getListingsByCategory(
      req.params.category,
      parseInt(limit),
      parseInt(offset)
    );

    const cleanListings = excludeVectorFieldsFromArray(listings);

    res.json({
      success: true,
      data: cleanListings,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: cleanListings.length
      }
    });
  } catch (error) {
    console.error('Get category listings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search listings by text (vector search) - public
router.get('/listings/search', async (req, res) => {
  try {
    const { q, category, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const results = await unifiedListingService.searchListings(q, category, parseInt(limit));

    const cleanResults = excludeVectorFieldsFromArray(results);

    res.json({
      success: true,
      data: cleanResults,
      query: q,
      category: category || 'all'
    });
  } catch (error) {
    console.error('Search listings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search by attributes (public)
router.post('/listings/search/attributes', async (req, res) => {
  try {
    const { category, filters, limit = 20, offset = 0 } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Category is required'
      });
    }

    const results = await unifiedListingService.searchByAttributes(
      category,
      filters || {},
      parseInt(limit),
      parseInt(offset)
    );

    const cleanResults = excludeVectorFieldsFromArray(results);

    res.json({
      success: true,
      data: cleanResults,
      filters,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: cleanResults.length
      }
    });
  } catch (error) {
    console.error('Search by attributes error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get listing by ID (public) - must be after search routes
router.get('/listings/:id', async (req, res) => {
  try {
    const listing = await unifiedListingService.getListingById(req.params.id);
    const cleanListing = excludeVectorFields(listing);
    res.json({
      success: true,
      data: cleanListing
    });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Update listing (requires auth - can only update own listings)
router.put('/listings/:id', authenticateToken, upload.array('images', 10), async (req, res) => {
  try {
    console.log('Update Listing req: ', req.body);
    // First get the listing to check ownership
    const existingListing = await unifiedListingService.getListingById(req.params.id);
    if (!existingListing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    // Ensure user can only update their own listings
    if (existingListing.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own listings'
      });
    }

    const updateData = {};

    if (req.body.title) updateData.title = req.body.title;
    if (req.body.description) updateData.description = req.body.description;
    if (req.body.price) updateData.price = parseFloat(req.body.price);
    if (req.body.phone_number !== undefined) updateData.phone_number = req.body.phone_number;
    if (req.body.location) updateData.location = JSON.parse(req.body.location);
    if (req.body.basic_attributes)
      updateData.basic_attributes = JSON.parse(req.body.basic_attributes);
    if (req.body.attributes) updateData.attributes = JSON.parse(req.body.attributes);
    if (req.body.status) updateData.status = req.body.status;

    const listing = await unifiedListingService.updateListing(
      existingListing,
      req.user.id,
      req.params.id,
      updateData,
      req.files
    );
    console.log('Update Listing res: ', listing);
    res.json({
      success: true,
      data: listing
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// New partial update endpoint preserving existing images if none provided
router.patch(
  '/listings/:id/partial',
  authenticateUserOrAdmin,
  upload.array('images', 10),
  async (req, res) => {
    try {
      const existingListing = await unifiedListingService.getListingById(req.params.id);
      if (!existingListing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }
      // If admin, bypass ownership check; otherwise enforce user ownership
      if (!req.admin) {
        if (!req.user || existingListing.user_id !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'You can only update your own listings'
          });
        }
      }

      const updateData = {};
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.price !== undefined) updateData.price = parseFloat(req.body.price);
      if (req.body.phone_number !== undefined) updateData.phone_number = req.body.phone_number;
      if (req.body.location) updateData.location = JSON.parse(req.body.location);
      if (req.body.basic_attributes)
        updateData.basic_attributes = JSON.parse(req.body.basic_attributes);
      if (req.body.attributes) updateData.attributes = JSON.parse(req.body.attributes);
      if (req.body.category) updateData.category = req.body.category;
      if (req.body.status) updateData.status = req.body.status; // optional manual status change

      const updated = await unifiedListingService.updateListingPreserveMedia(
        existingListing,
        req.user?.id || existingListing.user_id,
        req.params.id,
        updateData,
        req.files
      );

      res.json({ success: true, data: excludeVectorFields(updated) });
    } catch (error) {
      console.error('Update listing error:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

// Update listing status only (requires auth)
router.patch('/listings/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const updated = await unifiedListingService.updateListingStatus(
      req.params.id,
      req.user.id,
      status
    );
    res.json({ success: true, data: excludeVectorFields(updated) });
  } catch (error) {
    const code =
      error.message === 'Listing not found'
        ? 404
        : error.message.includes('only update')
          ? 403
          : 400;
    res.status(code).json({ success: false, error: error.message });
  }
});

// Delete listing (requires auth - can only delete own listings)
router.delete('/listings/:id', authenticateUserOrAdmin, async (req, res) => {
  try {
    // First get the listing to check ownership
    const existingListing = await unifiedListingService.getListingById(req.params.id);
    if (!existingListing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    // Ensure user can only delete their own listings; admins can delete any
    if (!req.admin) {
      if (!req.user || existingListing.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own listings'
        });
      }
    }

    const listing = await unifiedListingService.deleteListing(existingListing, req.params.id);
    res.json({
      success: true,
      data: listing,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ===== CATEGORY ROUTES =====

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await unifiedListingService.getCategories();
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific category
router.get('/categories/:category', async (req, res) => {
  try {
    const category = await unifiedListingService.getCategory(req.params.category);
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Create new category
router.post('/categories', async (req, res) => {
  try {
    const category = await unifiedListingService.createCategory(req.body);
    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update category
router.put('/categories/:category', async (req, res) => {
  try {
    const category = await unifiedListingService.updateCategory(req.params.category, req.body);
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete category
router.delete('/categories/:category', async (req, res) => {
  try {
    const category = await unifiedListingService.deleteCategory(req.params.category);
    res.json({
      success: true,
      data: category,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ===== CATEGORY MANAGEMENT ROUTES =====

// Validate categories
router.get('/categories/validate', async (req, res) => {
  try {
    const validation = await unifiedListingService.categoryModel.validateCategories();

    res.json({
      success: true,
      data: validation,
      message: validation.isValid ? 'All categories are valid' : 'Missing categories detected'
    });
  } catch (error) {
    console.error('Category validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== GEOCODING TEST ROUTES =====

// Test reverse geocoding
router.get('/geocoding/reverse', async (req, res) => {
  try {
    const { lat, lng, zoom = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude (lat) and longitude (lng) are required'
      });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const zoomNum = parseInt(zoom);

    if (!geocodingService.validateCoordinates(latNum, lngNum)) {
      return res.status(400).json({
        success: false,
        error:
          'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180'
      });
    }

    console.log(`🗺️ Testing reverse geocoding for coordinates: ${latNum}, ${lngNum}`);

    const result = await geocodingService.reverseGeocode(latNum, lngNum, zoomNum);

    console.log('📍 Reverse geocoding result:', JSON.stringify(result, null, 2));

    res.json({
      success: true,
      data: result,
      query: { lat: latNum, lng: lngNum, zoom: zoomNum }
    });
  } catch (error) {
    console.error('Reverse geocoding test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test forward geocoding
router.get('/geocoding/forward', async (req, res) => {
  try {
    const { q, country = 'do' } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query (q) is required'
      });
    }

    console.log(`🗺️ Testing forward geocoding for query: "${q}" in country: ${country}`);

    const result = await geocodingService.forwardGeocode(q, country);

    console.log('📍 Forward geocoding result:', JSON.stringify(result, null, 2));

    res.json({
      success: true,
      data: result,
      query: { q, country }
    });
  } catch (error) {
    console.error('Forward geocoding test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get geocoding service status
router.get('/geocoding/status', async (req, res) => {
  try {
    const status = geocodingService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Geocoding status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== SYSTEM ROUTES =====

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await unifiedListingService.getSystemStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
router.get('/health', async (req, res) => {
  try {
    const stats = await unifiedListingService.getSystemStats();
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        embedding: stats.embeddingModel.isInitialized ? 'ready' : 'initializing',
        minio: stats.minioStatus.status,
        geocoding: stats.geocodingStatus.status
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Generate product title and description from image using OpenAI
router.post('/autofill', authenticateUserOrAdmin, autofillUpload, async (req, res) => {
  try {
    // Get the uploaded file from either 'file' or 'image' field
    const uploadedFile = req.files?.file?.[0] || req.files?.image?.[0];
    
    // Check if image is provided
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: 'Image is required. Please upload an image using "file" or "image" field.'
      });
    }

    // Validate file type
    if (!uploadedFile.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'Only image files are allowed'
      });
    }

    // Initialize ImageAnalysisService
    const imageAnalysisService = new ImageAnalysisService();

    // Extract custom prompt from request body if provided
    const customPrompt = req.body.prompt || null;

    console.log('Analyzing image for product info generation...');

    // Generate product title and description
    const productInfo = await imageAnalysisService.generateProductInfo(
      uploadedFile.buffer,
      uploadedFile.mimetype,
      customPrompt,
      req.user?.country
    );

    console.log('Product info generated successfully:', productInfo);

    res.json({
      success: true,
      data: {
        title: productInfo.title,
        description: productInfo.description,
        imageInfo: {
          originalName: uploadedFile.originalname,
          mimeType: uploadedFile.mimetype,
          size: uploadedFile.size
        }
      }
    });

  } catch (error) {
    console.error('Error generating product info from image:', error);
    
    // Handle specific OpenAI errors
    if (error.message.includes('Image analysis failed')) {
      return res.status(422).json({
        success: false,
        error: 'Failed to analyze image. Please try with a different image.',
        details: error.message
      });
    }

    // Handle file size or format errors
    if (error.message.includes('File too large') || error.message.includes('Only image files')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error while processing image'
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum is 10 files.'
      });
    }
  }

  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      error: 'Only image files are allowed'
    });
  }

  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

module.exports = router;
