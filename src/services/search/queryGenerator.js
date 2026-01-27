const { OpenAI } = require('openai');
const { pool } = require('../../db');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

class QueryGenerator {
  constructor() {
    this.translations = {
      vehicles: {
        colors: {
          'black': ['negro', 'negra', 'black'],
          'white': ['blanco', 'blanca', 'white'],
          'red': ['rojo', 'roja', 'red'],
          'blue': ['azul', 'blue'],
          'gray': ['gris', 'grey', 'gray'],
          'silver': ['plateado', 'plateada', 'silver'],
          'green': ['verde', 'green'],
          'brown': ['marron', 'brown', 'cafe', 'café'],
          'yellow': ['amarillo', 'amarilla', 'yellow'],
          'gold': ['dorado', 'dorada', 'gold']
        },
        brands: {
          'mercedes': ['mercedes', 'mercedes-benz', 'mercedes benz', 'mercdez', 'mercedez'],
          'toyota': ['toyota'],
          'honda': ['honda'],
          'bmw': ['bmw'],
          'audi': ['audi'],
          'lexus': ['lexus'],
          'nissan': ['nissan']
        }
      },
      real_estate: {
        property_types: {
          'apartment': ['apartment', 'apartamento', 'apto', 'apt'],
          'house': ['house', 'casa', 'residencia'],
          'penthouse': ['penthouse', 'pent-house', 'ático', 'atico'],
          'villa': ['villa', 'villa residencial'],
          'condo': ['condo', 'condominio', 'condominium']
        },
        locations: {
          'santo domingo': [
            'santo domingo',
            'santo domingo este',
            'santo domingo norte',
            'santo domingo oeste',
            'distrito nacional',
            'sto domingo',
            'sto. domingo'
          ]
        },
        amenities: {
          'parking': ['parking', 'parqueo', 'garage', 'garaje'],
          'pool': ['pool', 'piscina', 'swimming pool'],
          'gym': ['gym', 'gimnasio'],
          'security': ['security', 'seguridad', '24/7', 'vigilancia']
        }
      },
      products: {
        categories: {
          'electronics': ['electronics', 'electrónicos', 'electronica', 'electrónica'],
          'clothing': ['clothing', 'ropa', 'vestimenta', 'clothes'],
          'furniture': ['furniture', 'muebles', 'mobiliario'],
          'toys': ['toys', 'juguetes'],
          'sports': ['sports', 'deportes', 'sporting goods']
        }
      }
    };

    // Stop words in English and Spanish
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'in', 'is', 'it', 'of', 'on', 'the', 'to', 'was', 'were',
      'will', 'with', 'looking', 'near', 'nearby', 'close', 'to', 'i', 'am',
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'cerca', 'de',
      'busco', 'buscando', 'quiero', 'necesito'
    ]);
  }

  escapeSQLString(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .trim();
  }

  sanitizeILIKEPattern(str) {
    return `%${this.escapeSQLString(str)}%`;
  }

  extractSearchTerms(query) {
    if (!query) return [];
    return query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 0 && !this.stopWords.has(word));
  }

  async generateSQL(category, query, language, page = 1, pageSize = 20) {
    try {
      const searchTerms = this.extractSearchTerms(query);
      const offset = (page - 1) * pageSize;

      if (!searchTerms.length) {
        return {
          text: `
            WITH filtered_items AS (
              SELECT hid
              FROM ${category}
              ORDER BY id
              LIMIT ${pageSize} OFFSET ${offset}
            ),
            total_count AS (
              SELECT COUNT(*) as count FROM ${category}
            )
            SELECT 
              array_agg(hid) as hids,
              t.count as total_count
            FROM filtered_items v
            CROSS JOIN total_count t
            GROUP BY t.count
          `,
          metadata: {
            page,
            pageSize,
            hasPagination: true,
            isMinimal: true
          }
        };
      }

      switch (category) {
        case 'vehicles': {
          // Build brand patterns (only exact matches for better performance)
          const brandPatterns = [];
          searchTerms.forEach(term => {
            Object.entries(this.translations.vehicles.brands).forEach(([brand, variations]) => {
              if (variations.some(v => v === term.toLowerCase())) {
                brandPatterns.push(brand.toLowerCase());
              }
            });
          });

          // Build model patterns (only exact matches)
          const modelPatterns = searchTerms
            .filter(term => term.length > 2)
            .map(term => term.toLowerCase());

          const conditions = [];
          if (brandPatterns.length > 0) {
            conditions.push(`LOWER(brand) = ANY(ARRAY[${brandPatterns.map(p => `'${p}'`).join(', ')}])`);
          }
          if (modelPatterns.length > 0) {
            conditions.push(`LOWER(model) = ANY(ARRAY[${modelPatterns.map(p => `'${p}'`).join(', ')}])`);
          }

          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : '';

          return {
            text: `
              WITH filtered_vehicles AS (
                SELECT hid
                FROM vehicles
                ${whereClause}
                ORDER BY id
                LIMIT ${pageSize} OFFSET ${offset}
              ),
              total_count AS (
                SELECT COUNT(*) as count 
                FROM vehicles
                ${whereClause}
              )
              SELECT 
                array_agg(hid) as hids,
                t.count as total_count
              FROM filtered_vehicles v
              CROSS JOIN total_count t
              GROUP BY t.count
            `,
            metadata: {
              page,
              pageSize,
              hasPagination: true,
              isMinimal: true
            }
          };
        }

        case 'real_estate': {
          // Similar optimization for real estate...
          const propertyPatterns = [];
          searchTerms.forEach(term => {
            Object.entries(this.translations.real_estate.property_types).forEach(([type, variations]) => {
              if (variations.some(v => v === term.toLowerCase())) {
                propertyPatterns.push(type.toLowerCase());
              }
            });
          });

          const conditions = [];
          if (propertyPatterns.length > 0) {
            conditions.push(`LOWER(property_type) = ANY(ARRAY[${propertyPatterns.map(p => `'${p}'`).join(', ')}])`);
          }

          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : '';

          return {
            text: `
              WITH filtered_properties AS (
                SELECT hid
                FROM real_estate
                ${whereClause}
                ORDER BY id
                LIMIT ${pageSize} OFFSET ${offset}
              ),
              total_count AS (
                SELECT COUNT(*) as count 
                FROM real_estate
                ${whereClause}
              )
              SELECT 
                array_agg(hid) as hids,
                t.count as total_count
              FROM filtered_properties p
              CROSS JOIN total_count t
              GROUP BY t.count
            `,
            metadata: {
              page,
              pageSize,
              hasPagination: true,
              isMinimal: true
            }
          };
        }

        case 'products': {
          // Similar optimization for products...
          const categoryPatterns = [];
          searchTerms.forEach(term => {
            Object.entries(this.translations.products.categories).forEach(([cat, variations]) => {
              if (variations.some(v => v === term.toLowerCase())) {
                categoryPatterns.push(cat.toLowerCase());
              }
            });
          });

          const conditions = [];
          if (categoryPatterns.length > 0) {
            conditions.push(`LOWER(category) = ANY(ARRAY[${categoryPatterns.map(p => `'${p}'`).join(', ')}])`);
          }

          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : '';

          return {
            text: `
              WITH filtered_products AS (
                SELECT hid
                FROM products
                ${whereClause}
                ORDER BY id
                LIMIT ${pageSize} OFFSET ${offset}
              ),
              total_count AS (
                SELECT COUNT(*) as count 
                FROM products
                ${whereClause}
              )
              SELECT 
                array_agg(hid) as hids,
                t.count as total_count
              FROM filtered_products p
              CROSS JOIN total_count t
              GROUP BY t.count
            `,
            metadata: {
              page,
              pageSize,
              hasPagination: true,
              isMinimal: true
            }
          };
        }

        default: {
          return {
            text: `SELECT ARRAY[]::text[] as hids, 0 as total_count`,
            metadata: {
              page,
              pageSize,
              hasPagination: true,
              isMinimal: true
            }
          };
        }
      }
    } catch (error) {
      console.error('SQL generation error:', error);
      return {
        text: `SELECT ARRAY[]::text[] as hids, 0 as total_count`,
        metadata: {
          page,
          pageSize,
          hasPagination: true,
          isMinimal: true
        }
      };
    }
  }
}

// Helper to validate a filter value against the DB for a given column and table
async function validateFilterValue(table, column, value) {
  if (!value) return null;
  const { rows } = await pool.query(
    `SELECT DISTINCT ${column} FROM ${table} WHERE ${column} ILIKE $1 LIMIT 1`,
    [`%${value}%`]
  );
  return rows.length > 0 ? rows[0][column] : null;
}

// Helper to build SQL with validated filters
async function buildValidatedSQL(category, filters, keywords, limit = 20, offset = 0) {
  let table = '';
  let where = [];
  let params = [];
  let paramIdx = 1;
  if (category === 'vehicles') table = 'vehicles';
  else if (category === 'real_estate') table = 'real_estate';
  else table = 'products';

  // Validate and add filters
  if (filters.brand) {
    const validBrand = await validateFilterValue(table, 'brand', filters.brand);
    if (validBrand) {
      where.push(`brand ILIKE $${paramIdx++}`);
      params.push(`%${validBrand}%`);
    }
  }
  if (filters.model && table === 'vehicles') {
    const validModel = await validateFilterValue(table, 'model', filters.model);
    if (validModel) {
      where.push(`model ILIKE $${paramIdx++}`);
      params.push(`%${validModel}%`);
    }
  }
  if (filters.location) {
    const validLocation = await validateFilterValue(table, 'location', filters.location);
    if (validLocation) {
      where.push(`location ILIKE $${paramIdx++}`);
      params.push(`%${validLocation}%`);
    }
  }
  if (filters.year && table === 'vehicles') {
    where.push(`year = $${paramIdx++}`);
    params.push(filters.year);
  }
  if (filters.bedrooms && table === 'real_estate') {
    where.push(`bedrooms = $${paramIdx++}`);
    params.push(filters.bedrooms);
  }
  if (filters.bathrooms && table === 'real_estate') {
    where.push(`bathrooms = $${paramIdx++}`);
    params.push(filters.bathrooms);
  }
  if (filters.condition && table === 'vehicles') {
    where.push(`condition ILIKE $${paramIdx++}`);
    params.push(`%${filters.condition}%`);
  }
  if (filters.min_price) {
    where.push(`price_value >= $${paramIdx++}`);
    params.push(filters.min_price);
  }
  if (filters.max_price) {
    where.push(`price_value <= $${paramIdx++}`);
    params.push(filters.max_price);
  }

  // Fallback: if no valid filters, use keywords for ILIKE search
  if (where.length === 0 && keywords && keywords.length > 0) {
    const keywordConds = [];
    const keywordCols = table === 'vehicles' ? ['brand', 'model', 'location'] :
                       table === 'real_estate' ? ['location', 'property_type'] :
                       ['brand', 'name', 'description', 'category'];
    for (const kw of keywords) {
      for (const col of keywordCols) {
        keywordConds.push(`${col} ILIKE $${paramIdx}`);
      }
      params.push(`%${kw}%`);
      paramIdx++;
    }
    if (keywordConds.length > 0) {
      where.push('(' + keywordConds.join(' OR ') + ')');
    }
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sql = `SELECT id, hid FROM ${table} ${whereClause} LIMIT ${limit} OFFSET ${offset}`;
  return { text: sql, values: params };
}

module.exports = {
  buildValidatedSQL
}; 