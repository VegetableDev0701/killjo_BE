const Listing = require('../models/Listing');
const Category = require('../models/Category');
// Servicio para generar texto estructurado para listings (NO genera embeddings, solo texto)
const listingTextService = require('./embeddingService');
const minioService = require('./minioService');
const geocodingService = require('./geocodingService');
const RekognitionService = require('./rekognitionService');
// Servicio para generar embeddings (vectores) usando OpenAI API
const EmbeddingService = require('./openAi/embaddingService');
const { User, UserFeature } = require('../db');
const { Op } = require('sequelize');
const redisService = require('./redisService');

class UnifiedListingService {
  constructor() {
    this.listingModel = Listing;
    this.categoryModel = Category;
  }

  // Initialize the system
  async initialize() {
    try {
      // Create tables
      await this.listingModel.createTable();
      await this.categoryModel.createTable();

      // Ensure phone_number column exists (for existing databases)

      // Initialize and validate default categories
      // (syncResult removed - no longer used in production)

      // Validate categories after sync
      const validation = await this.categoryModel.validateCategories();
      if (!validation.isValid) {
        console.warn(`⚠️ Missing categories detected: ${validation.missing.join(', ')}`);
      }

      console.log(
        `✅ Categories initialized: ${validation.total}/${validation.expected} categories available`
      );

      // Initialize services
      await listingTextService.initialize();

      // Initialize MinIO (required)
      await minioService.initialize();
      console.log('MinIO service initialized successfully');

      console.log('Unified listing system initialized successfully');
    } catch (error) {
      console.error('Error initializing unified listing system:', error);
      throw error;
    }
  }

  async isUserEligibleforListing(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return false; // Usuario no existe
      }

      if (user.verifiedStatus === "VERIFIED") return true;

      const count = await Listing.countListingByUserId(userId, user.verifiedStatus);
      if (count >= 5) return false;
      return true;
    } catch (error) {
      console.error('Error checking user eligibility:', error);
      // En caso de error, retornar false (más seguro que undefined)
      return false;
    }
  }

  // Create a new listing
  async createListing(listingData, files = [], options = {}) {
    try {
      const isAdmin = Boolean(options.isAdmin);
      // check if the user has any active subscription and if the user prodduct is more than 5 or not
      if (!isAdmin) {
        const isEligible = await this.isUserEligibleforListing(
          listingData.user_id        );

        if (!isEligible) {
          throw new Error('User is not eligible to create a listing');
        }

        const validationResult = this.categoryModel.validateAttributes(
          listingData.category,
          listingData.attributes || {}
        );
        if (!validationResult.isValid) {
          throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Validate phone number if provided
      if (listingData.phone_number && !isAdmin) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(listingData.phone_number.replace(/[\s\-\(\)]/g, ''))) {
          throw new Error('Invalid phone number format. Please provide a valid phone number.');
        }
      }

      // Process location data with reverse geocoding
      let enhancedLocation = listingData.location;

      // Handle different location input formats
      let coordinates = null;

      if (listingData.location && listingData.location.coordinates) {
        coordinates = listingData.location.coordinates;
      } else if (listingData.coordinates) {
        coordinates = listingData.coordinates;
      } else if (listingData.lat && listingData.lng) {
        coordinates = { lat: listingData.lat, lng: listingData.lng };
      }

      if (
        coordinates &&
        coordinates.lat &&
        coordinates.lng &&
        geocodingService.validateCoordinates(coordinates.lat, coordinates.lng)
      ) {
        try {
          console.log(
            `🗺️ Performing reverse geocoding for coordinates: ${coordinates.lat}, ${coordinates.lng}`
          );
          const geocodedAddress = await geocodingService.reverseGeocode(
            coordinates.lat,
            coordinates.lng
          );

          // Create clean location data from geocoding results
          listingData.location = {
            coordinates: {
              lat: coordinates.lat,
              lng: coordinates.lng
            },
            display_name: geocodedAddress.display_name,
            formatted_address: geocodedAddress.formatted_address,
            postcode: geocodedAddress.components.postcode,
            city: geocodedAddress.components.city,
            state: geocodedAddress.components.state,
            country: geocodedAddress.components.country,
            street: geocodedAddress.components.street,
            neighborhood: geocodedAddress.components.neighborhood,
            district: geocodedAddress.components.district,
            house_number: geocodedAddress.components.house_number
          };
        } catch (geocodingError) {
          console.warn(
            '⚠️ Reverse geocoding failed, using basic location data:',
            geocodingError.message
          );
        }
      }

      // Upload images if provided
      let mediaUrls = [];
      let moderationResults = [];
      if (files && files.length > 0) {
        console.log(
          `🔍 Processing ${files.length} images: moderation check + upload in parallel...`
        );
        // Run moderation checks and uploads in parallel
        const [moderationData, uploadResults] = await Promise.all([
          RekognitionService.checkMultipleImages(files),
          minioService.uploadMultipleImages(files, 'listings')
        ]);
        moderationResults = moderationData;
        mediaUrls = uploadResults.map(result => result.publicUrl);
      }

      // Generar texto estructurado para embedding (este servicio genera texto, no embeddings)
      const embeddingText = listingTextService.getEmbeddingTextForListing(listingData);
      // Generar embedding vector usando OpenAI API
      const embeddedVector = await EmbeddingService.embedText(embeddingText);

      const violatedImages = moderationResults.filter(result => !result.result.isContentSafe);
      let status = 'active';
      if (violatedImages.length > 0) {
        status = 'paused';
      }

      const isVerified = await User.findOne({
        where: { id: listingData.user_id, verifiedStatus: 'VERIFIED' }
      });

      listingData.is_verified = isVerified ? true : false;

      const listing = await this.listingModel.create({
        ...listingData,
        media: mediaUrls,
        vector: embeddedVector,
        status: status
      });

      // Invalidar cache de resultados de búsqueda (async, no bloquea)
      this.invalidateSearchCacheAsync().catch(err => {
        console.warn('⚠️ Failed to invalidate search cache:', err.message);
      });

      return listing;
    } catch (error) {
      console.error('Error creating listing:', error);
      throw error;
    }
  }

  async getListingById(id) {
    try {
      const listing = await this.listingModel.findById(id);
      if (!listing) {
        throw new Error('Listing not found');
      }
      return listing;
    } catch (error) {
      throw error;
    }
  }

  async getListingsByUser(userId, limit = 20, offset = 0) {
    try {
      // Get user's verification status to determine product visibility
      const user = await User.findByPk(userId);
      const userVerifiedStatus = user ? user.verifiedStatus : null;
      
      const listings = await this.listingModel.findByUserId(userId, limit, offset, userVerifiedStatus);
      return listings;
    } catch (error) {
      console.error('Error getting listings by user:', error);
      throw error;
    }
  }

  // Get listings by category
  async getListingsByCategory(category, limit = 20, offset = 0) {
    try {
      const listings = await this.listingModel.findByCategory(category, limit, offset);
      return listings;
    } catch (error) {
      console.error('Error getting listings by category:', error);
      throw error;
    }
  }

  // Search listings by text (vector search)
  async searchListings(query, category = null, limit = 10) {
    try {
      // Generate embedding for search query (usando servicio local Xenova)
      const queryEmbedding = await listingTextService.generateEmbedding(query);
      // Perform vector search
      const results = await this.listingModel.vectorSearch(queryEmbedding, limit, category);
      return results;
    } catch (error) {
      console.error('Error searching listings:', error);
      throw error;
    }
  }

  // Search by attributes
  async searchByAttributes(category, filters, limit = 20, offset = 0) {
    try {
      const results = await this.listingModel.searchByAttributes(category, filters, limit, offset);
      return results;
    } catch (error) {
      console.error('Error searching by attributes:', error);
      throw error;
    }
  }

  // Update listing
  async updateListing(existingListing, userId, id, updateData, files = []) {
    try {
      // Validate attributes if category is being updated
      if (updateData.category || updateData.attributes) {
        const category = updateData.category || existingListing.category;
        const attributes = updateData.attributes || existingListing.attributes;
        const validationResult = this.categoryModel.validateAttributes(category, attributes);
        if (!validationResult.isValid) {
          throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Validate phone number if provided
      if (updateData.phone_number) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(updateData.phone_number.replace(/[\s\-\(\)]/g, ''))) {
          throw new Error('Invalid phone number format. Please provide a valid phone number.');
        }
      }

      // Process location data with reverse geocoding if coordinates are updated
      let coordinates = null;

      // Extract coordinates using the same logic as createListing
      if (updateData.location?.coordinates) {
        coordinates = updateData.location.coordinates;
      } else if (updateData.coordinates) {
        coordinates = updateData.coordinates;
      } else if (updateData.lat && updateData.lng) {
        coordinates = { lat: updateData.lat, lng: updateData.lng };
      }

      // Update location with geocoding if new coordinates provided
      if (
        coordinates?.lat &&
        coordinates?.lng &&
        geocodingService.validateCoordinates(coordinates.lat, coordinates.lng)
      ) {
        try {
          const geocodedAddress = await geocodingService.reverseGeocode(
            coordinates.lat,
            coordinates.lng
          );
          updateData.location = {
            coordinates: {
              lat: coordinates.lat,
              lng: coordinates.lng
            },
            display_name: geocodedAddress.display_name,
            formatted_address: geocodedAddress.formatted_address,
            postcode: geocodedAddress.components.postcode,
            city: geocodedAddress.components.city,
            state: geocodedAddress.components.state,
            country: geocodedAddress.components.country,
            street: geocodedAddress.components.street,
            neighborhood: geocodedAddress.components.neighborhood,
            district: geocodedAddress.components.district,
            house_number: geocodedAddress.components.house_number
          };
        } catch (geocodingError) {
          console.warn('⚠️ Reverse geocoding failed:', geocodingError.message);
        }
      }

      // Process new images if provided
      updateData.media = [];
      let moderationResults = [];
      if (files?.length > 0) {
        const [moderationData, uploadResults] = await Promise.all([
          RekognitionService.checkMultipleImages(files),
          minioService.uploadMultipleImages(files, 'listings')
        ]);

        moderationResults = moderationData || [];
        updateData.media = uploadResults.map(result => result.publicUrl);
      }

      const deleteImages = existingListing.media || [];
      if (deleteImages.length > 0) {
        await Promise.all(
          deleteImages.map(imagePublicUrl => minioService.deleteImage(imagePublicUrl, 'listings'))
        );
      }

      const violatedImages = moderationResults.filter(result => !result.result.isContentSafe);
      if (violatedImages.length > 0) {
        updateData.status = 'paused';
      } else {
        updateData.status = 'active';
      }

      // Generate new embedding if content changed (using same method as createListing)
      if (
        updateData.title ||
        updateData.description ||
        updateData.attributes ||
        updateData.location ||
        updateData.basic_attributes ||
        updateData.category
      ) {
        // Generar texto estructurado para embedding
        const embeddingText = listingTextService.getEmbeddingTextForListing({
          ...existingListing,
          ...updateData
        });
        // Generar embedding vector usando OpenAI API
        updateData.vector = await EmbeddingService.embedText(embeddingText);
      }

      // Update listing in database
      const updatedListing = await this.listingModel.update(id, updateData);
      
      // Invalidar cache de resultados de búsqueda (async, no bloquea)
      this.invalidateSearchCacheAsync().catch(err => {
        console.warn('⚠️ Failed to invalidate search cache:', err.message);
      });
      
      return updatedListing;
    } catch (error) {
      console.error('Error updating listing:', error);
      throw error;
    }
  }

  /**
   * New (non-breaking) partial update that preserves existing images unless new ones are explicitly provided.
   * Mirrors original validation and embedding logic but skips media deletion when no files are passed.
   * @param {object} existingListing Existing listing record
   * @param {string} userId User performing update (already ownership-checked at route layer)
   * @param {string} id Listing ID
   * @param {object} updateData Fields to update (partial)
   * @param {Array} files Optional new image files
   * @returns Updated listing
   */
  async updateListingPreserveMedia(existingListing, userId, id, updateData, files = []) {
    try {
      // Validate attributes if category or attributes provided
      if (updateData.category || updateData.attributes) {
        const category = updateData.category || existingListing.category;
        const attributes = updateData.attributes || existingListing.attributes;
        const validationResult = this.categoryModel.validateAttributes(category, attributes);
        if (!validationResult.isValid) {
          throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Phone number validation
      if (updateData.phone_number) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(updateData.phone_number.replace(/[\s\-\(\)]/g, ''))) {
          throw new Error('Invalid phone number format. Please provide a valid phone number.');
        }
      }

      // Geocoding if coordinates present
      let coordinates = null;
      if (updateData.location?.coordinates) {
        coordinates = updateData.location.coordinates;
      } else if (updateData.coordinates) {
        coordinates = updateData.coordinates;
      } else if (updateData.lat && updateData.lng) {
        coordinates = { lat: updateData.lat, lng: updateData.lng };
      }

      if (
        coordinates?.lat &&
        coordinates?.lng &&
        geocodingService.validateCoordinates(coordinates.lat, coordinates.lng)
      ) {
        try {
          const geocodedAddress = await geocodingService.reverseGeocode(
            coordinates.lat,
            coordinates.lng
          );
          updateData.location = {
            coordinates: { lat: coordinates.lat, lng: coordinates.lng },
            display_name: geocodedAddress.display_name,
            formatted_address: geocodedAddress.formatted_address,
            postcode: geocodedAddress.components.postcode,
            city: geocodedAddress.components.city,
            state: geocodedAddress.components.state,
            country: geocodedAddress.components.country,
            street: geocodedAddress.components.street,
            neighborhood: geocodedAddress.components.neighborhood,
            district: geocodedAddress.components.district,
            house_number: geocodedAddress.components.house_number
          };
        } catch (geocodingError) {
          console.warn('⚠️ Reverse geocoding failed:', geocodingError.message);
        }
      }

      let moderationResults = [];
      let newMedia = null;
      if (files?.length > 0) {
        const [moderationData, uploadResults] = await Promise.all([
          RekognitionService.checkMultipleImages(files),
          minioService.uploadMultipleImages(files, 'listings')
        ]);
        moderationResults = moderationData || [];
        newMedia = uploadResults.map(r => r.publicUrl);

        // Delete old media ONLY when replacing with new
        const oldImages = existingListing.media || [];
        if (oldImages.length > 0) {
          await Promise.all(
            oldImages.map(img => minioService.deleteImage(img, 'listings').catch(() => null))
          );
        }
        updateData.media = newMedia;
      }

      // Only adjust status if new images processed (moderation context)
      if (files?.length > 0) {
        const violatedImages = moderationResults.filter(r => !r.result.isContentSafe);
        updateData.status = violatedImages.length > 0 ? 'paused' : 'active';
      }

      // Re-embed if relevant textual/location/category fields changed
      if (
        updateData.title ||
        updateData.description ||
        updateData.attributes ||
        updateData.location ||
        updateData.basic_attributes ||
        updateData.category
      ) {
        // Generar texto estructurado para embedding
        const embeddingText = listingTextService.getEmbeddingTextForListing({
          ...existingListing,
          ...updateData,
          media: newMedia || existingListing.media // ensure media not lost in embedding context
        });
        // Generar embedding vector usando OpenAI API
        updateData.vector = await EmbeddingService.embedText(embeddingText);
      }

      const updatedListing = await this.listingModel.update(id, updateData);
      return updatedListing;
    } catch (error) {
      console.error('Error updating listing (preserve media):', error);
      throw error;
    }
  }

  /**
   * Update only the status of a listing (lightweight path – no re-embedding or media work)
   * @param {string} id Listing ID
   * @param {string} userId Authenticated user ID
   * @param {string} status New status value
   * @returns Updated listing
   */
  async updateListingStatus(id, userId, status) {
    try {
      const allowedStatuses = ['active', 'paused', 'hidden']; // Extend here if more statuses supported
      if (!allowedStatuses.includes(status)) {
        throw new Error(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`);
      }

      const listing = await this.getListingById(id);
      if (!listing) {
        throw new Error('Listing not found');
      }
      if (listing.user_id !== userId) {
        throw new Error('You can only update status of your own listings');
      }

      if (listing.status === status) {
        return listing; // No change needed
      }

      const updated = await this.listingModel.update(id, { status });
      
      // Invalidar cache de resultados de búsqueda si el status cambia a/desde 'active'
      // (async, no bloquea)
      this.invalidateSearchCacheAsync().catch(err => {
        console.warn('⚠️ Failed to invalidate search cache:', err.message);
      });
      
      return updated;
    } catch (error) {
      console.error('Error updating listing status:', error);
      throw error;
    }
  }

  // Delete listing (soft delete)
  async deleteListing(existingListing, id) {
    try {
      const deleteImages = existingListing.media || [];
      if (deleteImages.length > 0) {
        await Promise.all(
          deleteImages.map(imagePublicUrl => minioService.deleteImage(imagePublicUrl, 'listings'))
        );
      }

      const deletedListing = await this.listingModel.delete(id);
      
      // Invalidar cache de resultados de búsqueda (async, no bloquea)
      this.invalidateSearchCacheAsync().catch(err => {
        console.warn('⚠️ Failed to invalidate search cache:', err.message);
      });
      
      return deletedListing;
    } catch (error) {
      console.error('Error deleting listing:', error);
      throw error;
    }
  }

  // Get all categories
  async getCategories() {
    try {
      const categories = await this.categoryModel.findAll();
      return categories;
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  // Get specific category
  async getCategory(categoryKey) {
    try {
      const category = await this.categoryModel.findByKey(categoryKey);
      if (!category) {
        throw new Error(`Category '${categoryKey}' not found`);
      }
      return category;
    } catch (error) {
      console.error('Error getting category:', error);
      throw error;
    }
  }

  // Create new category
  async createCategory(categoryData) {
    try {
      const category = await this.categoryModel.create(categoryData);
      return category;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  // Update category
  async updateCategory(categoryKey, updateData) {
    try {
      const category = await this.categoryModel.update(categoryKey, updateData);
      return category;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  // Delete category
  async deleteCategory(categoryKey) {
    try {
      const category = await this.categoryModel.delete(categoryKey);
      return category;
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  // Get system statistics
  async getSystemStats() {
    try {
      const stats = {
        totalListings: 0,
        categories: [],
        categoryCounts: [],
        embeddingModel: listingTextService.getModelInfo(),
        minioStatus: { status: 'not_configured' },
        geocodingStatus: geocodingService.getStatus()
      };

      // Get total listings count
      const countResult = await this.listingModel.pool.query(
        "SELECT COUNT(*) FROM listings WHERE status = 'active'"
      );
      stats.totalListings = parseInt(countResult.rows[0].count);

      // Get categories with counts
      const categoryResult = await this.listingModel.pool.query(`
        SELECT category, COUNT(*) as count 
        FROM listings 
        WHERE status = 'active' 
        GROUP BY category 
        ORDER BY count DESC
      `);
      stats.categoryCounts = categoryResult.rows;

      // Get all categories
      stats.categories = await this.categoryModel.findAll();

      // Get MinIO status
      stats.minioStatus = await minioService.getStatus();

      return stats;
    } catch (error) {
      console.error('Error getting system stats:', error);
      throw error;
    }
  }

  /**
   * Invalida cache de resultados de búsqueda de forma async
   * Se llama cuando se crea, actualiza o elimina un listing
   * 
   * IMPORTANTE: Esta función borra TODO el cache de resultados de búsqueda (search:complete:*)
   * porque cualquier cambio en listings puede afectar cualquier búsqueda.
   * Es una estrategia conservadora que garantiza frescura de resultados.
   * 
   * En el futuro, se podría optimizar invalidando solo caches relacionados con:
   * - La categoría del listing modificado
   * - Búsquedas que incluyan filtros específicos afectados
   */
  async invalidateSearchCacheAsync() {
    if (process.env.ENABLE_RESULT_CACHE !== 'true') {
      return;
    }

    try {
      // Invalidar todos los resultados de búsqueda usando SCAN para mejor performance
      // NOTA: Borra TODO el cache (search:complete:*) para garantizar frescura
      const pattern = 'search:complete:*';
      
      // Usar SCAN para mejor performance en producción (no bloquea Redis)
      const stream = redisService.client.scanStream({
        match: pattern,
        count: 100
      });
      
      let deletedCount = 0;
      const pipeline = redisService.client.pipeline();
      
      stream.on('data', (keys) => {
        keys.forEach(key => {
          pipeline.del(key);
          deletedCount++;
        });
      });
      
      return new Promise((resolve, reject) => {
        stream.on('end', async () => {
          if (deletedCount > 0) {
            await pipeline.exec();
            console.log(`✅ Invalidated ${deletedCount} cached search results`);
          }
          resolve();
        });
        
        stream.on('error', (err) => {
          console.warn('⚠️ Error scanning cache keys:', err.message);
          resolve(); // No fallar, solo loggear
        });
      });
    } catch (error) {
      // No bloquear si falla
      console.warn('⚠️ Failed to invalidate search cache:', error.message);
    }
  }
}

module.exports = new UnifiedListingService();
