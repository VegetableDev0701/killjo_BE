const { pool } = require('../../db');

class VectorSearchService {
  constructor() {
    this.englishModel = null;
    this.spanishModel = null;
    this.embeddingDimension = 384;
    this.transformers = null; // Will be loaded dynamically
  }

  async initialize() {
    if (this.englishModel && this.spanishModel) return; // Already initialized
    
    try {
      console.log('🚀 Initializing bilingual vector search models...');
      
      // Dynamically import transformers
      if (!this.transformers) {
        try {
          const transformersModule = await import('@xenova/transformers');
          this.transformers = transformersModule.pipeline;
          console.log('✅ Transformers module loaded!');
        } catch (error) {
          console.error('❌ Failed to load transformers module:', error);
          throw new Error('Failed to load embedding model dependencies');
        }
      }
      
      // Load English model
      this.englishModel = await this.transformers('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: false
      });
      
      // Load Spanish model
      this.spanishModel = await this.transformers('feature-extraction', 'Xenova/distiluse-base-multilingual-cased', {
        quantized: false
      });
      
      console.log('✅ Bilingual vector search models loaded!');
    } catch (error) {
      console.error('❌ Error initializing bilingual vector search models:', error);
      throw error;
    }
  }

  // Language detection (same as in embedding generator)
  detectLanguage(text) {
    if (!text) return 'en';
    
    const spanishWords = [
      'auto', 'coche', 'carro', 'vehículo', 'marca', 'modelo', 'año', 'condición',
      'combustible', 'transmisión', 'ubicación', 'exterior', 'interior', 'motor',
      'tracción', 'pasajeros', 'concesionario', 'dirección', 'accesorios', 'precio',
      'usado', 'nuevo', 'semi', 'gasolina', 'diésel', 'eléctrico', 'híbrido',
      'automático', 'manual', 'negro', 'blanco', 'rojo', 'azul', 'gris', 'plata'
    ];
    
    const textLower = text.toLowerCase();
    const spanishMatches = spanishWords.filter(word => textLower.includes(word)).length;
    const englishMatches = textLower.split(/\s+/).filter(word => word.length > 2).length;
    
    if (spanishMatches > 0 && (spanishMatches / Math.max(englishMatches, 1)) > 0.3) {
      return 'es';
    }
    
    return 'en';
  }

  async generateQueryEmbedding(query, language = null) {
    try {
      if (!this.englishModel || !this.spanishModel) {
        await this.initialize();
      }

      // Detect language if not provided
      if (!language) {
        language = this.detectLanguage(query);
      }

      const cleanQuery = query.trim().substring(0, 512);
      
      // Choose appropriate model
      const model = language === 'es' ? this.spanishModel : this.englishModel;
      
      const result = await model(cleanQuery, {
        pooling: 'mean',
        normalize: true
      });
      
      const embedding = Array.from(result.data);
      
      // Ensure correct dimension
      if (embedding.length !== this.embeddingDimension) {
        if (embedding.length > this.embeddingDimension) {
          return embedding.slice(0, this.embeddingDimension);
        } else {
          return [...embedding, ...new Array(this.embeddingDimension - embedding.length).fill(0)];
        }
      }
      
      return embedding;
    } catch (error) {
      console.error('❌ Error generating query embedding:', error);
      throw error;
    }
  }

  async searchBySimilarity(query, limit = 20, offset = 0, minSimilarity = 0.1, language = null) {
    try {
      const client = await pool.connect();
      
      try {
        // Detect language if not provided
        if (!language) {
          language = this.detectLanguage(query);
        }
        
        // Generate embedding for the query
        const queryEmbedding = await this.generateQueryEmbedding(query, language);
        
        // Choose appropriate embedding column based on language
        const embeddingColumn = language === 'es' ? 'embeddings_es' : 'embeddings_en';
        
        // Search for similar vehicles using cosine similarity
        const result = await client.query(`
          SELECT 
            id, hid, brand, model, year, condition, fuel, transmission,
            location, exterior, interior, engine, traction, passengers,
            dealer, address, accessories, price_value, language_detected,
            cosine_similarity(${embeddingColumn}, $1) as similarity
          FROM vehicles 
          WHERE ${embeddingColumn} IS NOT NULL 
          AND cosine_similarity(${embeddingColumn}, $1) >= $2
          ORDER BY similarity DESC 
          LIMIT $3 OFFSET $4
        `, [queryEmbedding, minSimilarity, limit, offset]);
        
        // Get total count for pagination
        const countResult = await client.query(`
          SELECT COUNT(*) as total
          FROM vehicles 
          WHERE ${embeddingColumn} IS NOT NULL 
          AND cosine_similarity(${embeddingColumn}, $1) >= $2
        `, [queryEmbedding, minSimilarity]);
        
        const totalCount = parseInt(countResult.rows[0].total);
        
        return {
          results: result.rows.map(row => ({
            hid: row.hid,
            similarity: row.similarity,
            language: row.language_detected,
            metadata: {
              brand: row.brand,
              model: row.model,
              year: row.year,
              condition: row.condition,
              location: row.location,
              price: row.price_value
            }
          })),
          totalCount,
          queryEmbedding: queryEmbedding.slice(0, 10),
          searchType: 'vector_similarity',
          language: language
        };
        
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Error in vector similarity search:', error);
      throw error;
    }
  }

  async hybridSearch(query, limit = 20, offset = 0, language = null) {
    try {
      const client = await pool.connect();
      
      try {
        // Detect language if not provided
        if (!language) {
          language = this.detectLanguage(query);
        }
        
        // Generate embedding for the query
        const queryEmbedding = await this.generateQueryEmbedding(query, language);
        
        // Choose appropriate embedding column
        const embeddingColumn = language === 'es' ? 'embeddings_es' : 'embeddings_en';
        
        // Extract keywords for traditional search
        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
        
        // Build keyword conditions
        const keywordConditions = [];
        const params = [queryEmbedding, limit, offset];
        let paramIndex = 4;
        
        keywords.forEach(keyword => {
          keywordConditions.push(`(
            LOWER(brand) ILIKE $${paramIndex} OR 
            LOWER(model) ILIKE $${paramIndex} OR 
            LOWER(location) ILIKE $${paramIndex} OR 
            LOWER(condition) ILIKE $${paramIndex} OR 
            LOWER(fuel) ILIKE $${paramIndex}
          )`);
          params.push(`%${keyword}%`);
          paramIndex++;
        });
        
        const keywordWhereClause = keywordConditions.length > 0 
          ? `AND (${keywordConditions.join(' OR ')})` 
          : '';
        
        // Hybrid search: combine vector similarity with keyword matching
        const result = await client.query(`
          SELECT 
            id, hid, brand, model, year, condition, fuel, transmission,
            location, exterior, interior, engine, traction, passengers,
            dealer, address, accessories, price_value, language_detected,
            cosine_similarity(${embeddingColumn}, $1) as similarity
          FROM vehicles 
          WHERE ${embeddingColumn} IS NOT NULL 
          ${keywordWhereClause}
          ORDER BY 
            CASE 
              WHEN cosine_similarity(${embeddingColumn}, $1) > 0.5 THEN 1
              WHEN cosine_similarity(${embeddingColumn}, $1) > 0.3 THEN 2
              ELSE 3
            END,
            similarity DESC
          LIMIT $2 OFFSET $3
        `, params);
        
        // Get total count
        const countResult = await client.query(`
          SELECT COUNT(*) as total
          FROM vehicles 
          WHERE ${embeddingColumn} IS NOT NULL 
          ${keywordWhereClause}
        `, params.slice(3));
        
        const totalCount = parseInt(countResult.rows[0].total);
        
        return {
          results: result.rows.map(row => ({
            hid: row.hid,
            similarity: row.similarity,
            language: row.language_detected,
            metadata: {
              brand: row.brand,
              model: row.model,
              year: row.year,
              condition: row.condition,
              location: row.location,
              price: row.price_value
            }
          })),
          totalCount,
          queryEmbedding: queryEmbedding.slice(0, 10),
          searchType: 'hybrid',
          language: language
        };
        
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Error in hybrid search:', error);
      throw error;
    }
  }

  async crossLanguageSearch(query, limit = 20, offset = 0) {
    try {
      const client = await pool.connect();
      
      try {
        // Generate embeddings for both languages
        const englishEmbedding = await this.generateQueryEmbedding(query, 'en');
        const spanishEmbedding = await this.generateQueryEmbedding(query, 'es');
        
        // Search using both embeddings and combine results
        const result = await client.query(`
          SELECT 
            id, hid, brand, model, year, condition, fuel, transmission,
            location, exterior, interior, engine, traction, passengers,
            dealer, address, accessories, price_value, language_detected,
            GREATEST(
              cosine_similarity(embeddings_en, $1),
              cosine_similarity(embeddings_es, $2)
            ) as similarity,
            CASE 
              WHEN cosine_similarity(embeddings_en, $1) > cosine_similarity(embeddings_es, $2) 
              THEN 'en' ELSE 'es' 
            END as best_match_language
          FROM vehicles 
          WHERE embeddings_en IS NOT NULL OR embeddings_es IS NOT NULL
          ORDER BY similarity DESC 
          LIMIT $3 OFFSET $4
        `, [englishEmbedding, spanishEmbedding, limit, offset]);
        
        // Get total count
        const countResult = await client.query(`
          SELECT COUNT(*) as total
          FROM vehicles 
          WHERE embeddings_en IS NOT NULL OR embeddings_es IS NOT NULL
        `);
        
        const totalCount = parseInt(countResult.rows[0].total);
        
        return {
          results: result.rows.map(row => ({
            hid: row.hid,
            similarity: row.similarity,
            language: row.language_detected,
            bestMatchLanguage: row.best_match_language,
            metadata: {
              brand: row.brand,
              model: row.model,
              year: row.year,
              condition: row.condition,
              location: row.location,
              price: row.price_value
            }
          })),
          totalCount,
          searchType: 'cross_language',
          languages: ['en', 'es']
        };
        
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Error in cross-language search:', error);
      throw error;
    }
  }

  async getSimilarVehicles(vehicleId, limit = 10, language = null) {
    try {
      const client = await pool.connect();
      
      try {
        // Get the vehicle's embeddings
        const vehicleResult = await client.query(`
          SELECT id, brand, model, embeddings_en, embeddings_es, language_detected
          FROM vehicles 
          WHERE id = $1 AND (embeddings_en IS NOT NULL OR embeddings_es IS NOT NULL)
        `, [vehicleId]);
        
        if (vehicleResult.rows.length === 0) {
          throw new Error('Vehicle not found or no embeddings available');
        }
        
        const vehicle = vehicleResult.rows[0];
        
        // Use detected language or provided language
        const searchLanguage = language || vehicle.language_detected || 'en';
        const embeddingColumn = searchLanguage === 'es' ? 'embeddings_es' : 'embeddings_en';
        const vehicleEmbedding = searchLanguage === 'es' ? vehicle.embeddings_es : vehicle.embeddings_en;
        
        if (!vehicleEmbedding) {
          throw new Error(`No ${searchLanguage} embeddings available for this vehicle`);
        }
        
        // Find similar vehicles
        const similarResult = await client.query(`
          SELECT 
            id, hid, brand, model, year, condition, fuel, transmission,
            location, price_value, language_detected,
            cosine_similarity(${embeddingColumn}, $1) as similarity
          FROM vehicles 
          WHERE ${embeddingColumn} IS NOT NULL 
          AND id != $2
          AND cosine_similarity(${embeddingColumn}, $1) > 0.3
          ORDER BY similarity DESC 
          LIMIT $3
        `, [vehicleEmbedding, vehicleId, limit]);
        
        return {
          originalVehicle: {
            id: vehicle.id,
            brand: vehicle.brand,
            model: vehicle.model,
            language: vehicle.language_detected
          },
          searchLanguage: searchLanguage,
          similarVehicles: similarResult.rows.map(row => ({
            hid: row.hid,
            similarity: row.similarity,
            language: row.language_detected,
            metadata: {
              brand: row.brand,
              model: row.model,
              year: row.year,
              condition: row.condition,
              location: row.location,
              price: row.price_value
            }
          }))
        };
        
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Error getting similar vehicles:', error);
      throw error;
    }
  }

  async getEmbeddingStats() {
    try {
      const client = await pool.connect();
      
      try {
        const statsResult = await client.query(`
          SELECT 
            COUNT(*) as total_vehicles,
            COUNT(embeddings_en) as vehicles_with_embeddings_en,
            COUNT(embeddings_es) as vehicles_with_embeddings_es,
            COUNT(CASE WHEN language_detected = 'en' THEN 1 END) as english_content,
            COUNT(CASE WHEN language_detected = 'es' THEN 1 END) as spanish_content,
            AVG(array_length(embeddings_en, 1)) as avg_embedding_dimension_en,
            AVG(array_length(embeddings_es, 1)) as avg_embedding_dimension_es
          FROM vehicles
        `);
        
        const stats = statsResult.rows[0];
        
        return {
          totalVehicles: parseInt(stats.total_vehicles),
          vehiclesWithEmbeddingsEn: parseInt(stats.vehicles_with_embeddings_en),
          vehiclesWithEmbeddingsEs: parseInt(stats.vehicles_with_embeddings_es),
          englishContent: parseInt(stats.english_content),
          spanishContent: parseInt(stats.spanish_content),
          avgEmbeddingDimensionEn: parseFloat(stats.avg_embedding_dimension_en) || 0,
          avgEmbeddingDimensionEs: parseFloat(stats.avg_embedding_dimension_es) || 0,
          coveragePercentageEn: (parseInt(stats.vehicles_with_embeddings_en) / parseInt(stats.total_vehicles) * 100).toFixed(2),
          coveragePercentageEs: (parseInt(stats.vehicles_with_embeddings_es) / parseInt(stats.total_vehicles) * 100).toFixed(2)
        };
        
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Error getting embedding stats:', error);
      throw error;
    }
  }
}

module.exports = new VectorSearchService(); 