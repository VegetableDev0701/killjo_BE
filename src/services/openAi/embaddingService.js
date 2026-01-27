const axios = require('axios');
const crypto = require('crypto');
const redisService = require('../redisService');

class EmbeddingService {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.OPENAI_API_KEY;
        this.baseURL = 'https://api.openai.com/v1';
        this.model = 'text-embedding-3-small'; // Latest embedding model
        
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required');
        }
    }

    /**
     * Normalización robusta para cache consistente
     * - Unicode normalization (NFC)
     * - Lowercase
     * - Trim y normalización de espacios
     * - Eliminación de caracteres de control ([\x00-\x1F\x7F])
     * 
     * NOTA: La normalización solo afecta la cache key, NO el texto enviado a OpenAI.
     * El texto original se envía a la API para preservar fidelidad.
     * 
     * Caracteres de control: Se eliminan conscientemente para evitar cache keys
     * inconsistentes por caracteres invisibles (tabs, newlines, etc.).
     * Si prefieres ser ultra-conservador, puedes comentar esa línea.
     */
    normalizeTextForCache(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Text must be a non-empty string');
        }
        
        return text
            .normalize('NFC') // Normaliza Unicode (é → é, no e + ´)
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ') // Normaliza espacios múltiples
            .replace(/[\x00-\x1F\x7F]/g, ''); // Elimina caracteres de control (tabs, newlines, etc.)
    }

    /**
     * Embed a single text string with caching
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} - Vector embedding
     */
    async embedText(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Text must be a non-empty string');
        }
        
        // Verificar si cache está habilitado
        const cacheEnabled = process.env.ENABLE_EMBEDDING_CACHE === 'true';
        
        // Normalizar para cache key (determinístico)
        const normalizedText = this.normalizeTextForCache(text);
        
        // Generar clave de cache: modelo + hash del texto normalizado
        const cacheKey = `embedding:${this.model}:${crypto
            .createHash('sha256')
            .update(normalizedText)
            .digest('hex')}`;
        
        // Intentar obtener de cache con manejo de errores
        if (cacheEnabled) {
            try {
                const cached = await redisService.getCachedResults(cacheKey);
                if (cached && Array.isArray(cached) && cached.length > 0) {
                    console.log('✅ Embedding from cache');
                    // Retornar array puro number[] sin metadata
                    // El cache hit se trackea en métricas, no dentro del vector
                    return cached.slice(); // Copia del array (number[] puro)
                }
            } catch (error) {
                // Si Redis falla, continuar sin cache (no bloquear)
                console.warn('⚠️ Redis cache error, continuing without cache:', error.message);
            }
        }
        
        // Si no está en cache, generar (usar texto original para API)
        // NOTA: OpenAI API puede manejar texto con acentos, espacios, etc.
        // El cache key usa texto normalizado, pero la API recibe el original
        let embedding;
        try {
            const response = await axios.post(
                `${this.baseURL}/embeddings`,
                {
                    input: text, // Texto original para API
                    model: this.model
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000 // Timeout de 10s
                }
            );
            
            embedding = response.data.data[0].embedding;
            
            // Validar embedding antes de cachear
            if (!Array.isArray(embedding) || embedding.length === 0) {
                throw new Error('Invalid embedding received from API');
            }
        } catch (error) {
            console.error('Error embedding text:', error.response?.data || error.message);
            throw new Error(`Failed to embed text: ${error.message}`);
        }
        
        // Cachear con manejo de errores (no bloquear si falla)
        if (cacheEnabled) {
            try {
                const ttl = parseInt(process.env.EMBEDDING_CACHE_TTL || '604800', 10); // 7 días default
                await redisService.cacheSearchResults(cacheKey, embedding, ttl);
            } catch (error) {
                // Si cache falla, continuar (no crítico)
                console.warn('⚠️ Failed to cache embedding, continuing:', error.message);
            }
        }
        
        return embedding;
    }

    /**
     * Get embedding dimensions for the current model
     * @returns {number} - Embedding dimensions
     */
    getEmbeddingDimensions() {
        const dimensions = {
            'text-embedding-3-small': 1536,
            'text-embedding-3-large': 3072,
            'text-embedding-ada-002': 1536
        };
        return dimensions[this.model] || 1536;
    }

    /**
     * Set the embedding model
     * @param {string} model - Model name
     */
    setModel(model) {
        this.model = model;
    }
}

module.exports = new EmbeddingService();