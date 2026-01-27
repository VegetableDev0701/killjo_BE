const redisService = require('../services/redisService');
const { Pool } = require('pg');
const GraphQLJSON = require('graphql-type-json');


const pool = new Pool({
  connectionString: process.env.LISTING_URL,
  ssl: false,
});

// Centralized table names configuration
const TABLE_NAMES = {
  vehicles: 'vehicles_color_v1',
  real_estate: 'real_estate_v2',
  products: 'products_clean'
};

function parsePriceValue(val) {
  if (typeof val === 'number') return val;
  if (!val) return null;
  const cleaned = String(val).replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseImages(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const arr = JSON.parse(val);
      if (Array.isArray(arr)) return arr;
    } catch { }
    return [val];
  }
  return [];
}

async function getItemsFromCacheOrDB(hids, category) {
  const items = [];
  const uncachedHids = [];
  for (const hid of hids) {
    const cachedItem = await redisService.getCachedResults(`${category}:item:${hid}`);
    if (cachedItem) {
      items.push(cachedItem);
    } else {
      uncachedHids.push(hid);
    }
  }
  if (uncachedHids.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('SET statement_timeout = 5000');
      const tableName = TABLE_NAMES[category];
      if (!tableName) {
        throw new Error(`Invalid category: ${category}`);
      }
      const query = `SELECT * FROM ${tableName} WHERE hid = ANY($1)`;
      const { rows } = await client.query(query, [uncachedHids]);
      await Promise.all(
        rows.map(item =>
          redisService.cacheSearchResults(
            `${category}:item:${item.hid}`,
            item,
            300
          )
        )
      );
      items.push(...rows);
    } finally {
      client.release();
    }
  }
  return hids.map(hid => items.find(item => item.hid === hid)).filter(Boolean);
}

async function getListingItemsFromCacheOrDB(listingIds) {
  const items = [];
  const uncachedIds = [];
  for (const id of listingIds) {
    const cachedItem = await redisService.getCachedResults(`listing:${id}`);
    if (cachedItem) {
      items.push(cachedItem);
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length > 0) {
    const client = await pool.connect();
    try {
      const query = `SELECT * FROM listings WHERE id = ANY($1)`;
      const { rows } = await client.query(query, [uncachedIds]);
      await Promise.all(
        rows.map(item =>
          redisService.cacheSearchResults(
            `listing:${item.id}`,
            item,
            300
          )
        )
      );
      items.push(...rows);
    } finally {
      client.release();
    }
  }
  return listingIds.map(id => items.find(item => item.id === id)).filter(Boolean);
}

const resolvers = {
  JSON: GraphQLJSON,

  Query: {
    getListingsByIds: async (_, { listingIds }) => {
      if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
        throw new Error('Invalid listingIds parameter');
      }

      const items = await getListingItemsFromCacheOrDB(listingIds);
      const itemsMapped = items.map(item => {
        const mappedItem = mapListItemToSchema(item);
        mappedItem.__typename = 'Listing';
        return mappedItem;
      });
      return {
        items: itemsMapped,
        totalCount: itemsMapped.length,
        page: 1,
        totalPages: 1
      };
    },

    getItemsByHids: async (_, { hids, category }) => {
      if (!hids || !Array.isArray(hids) || hids.length === 0) {
        throw new Error('Invalid hids parameter');
      }
      if (!Object.keys(TABLE_NAMES).includes(category)) {
        throw new Error('Invalid category');
      }
      const items = await getItemsFromCacheOrDB(hids, category);
      const itemsMapped = items.map(item => {
        const mappedItem = mapItemToSchema(item, category);
        mappedItem.__typename = category === 'vehicles' ? 'Vehicle' :
          category === 'real_estate' ? 'RealEstate' : 'Product';
        return mappedItem;
      });
      return {
        items: itemsMapped,
        totalCount: itemsMapped.length,
        page: 1,
        totalPages: 1
      };
    },
    getProductByHid: async (_, { hid }) => {
      const client = await pool.connect();
      try {
        const { rows } = await client.query(
          `SELECT * FROM ${TABLE_NAMES.products} WHERE hid = $1 LIMIT 1`,
          [hid]
        );
        const product = rows[0] || null;
        if (product) {
          const mappedProduct = mapItemToSchema(product, 'products');
          mappedProduct.__typename = 'Product';
          return mappedProduct;
        }
        return null;
      } finally {
        client.release();
      }
    },
    getProductsByHids: async (_, { hids }) => {
      const client = await pool.connect();
      try {
        const { rows } = await client.query(
          `SELECT * FROM ${TABLE_NAMES.products} WHERE hid = ANY($1)`,
          [hids]
        );
        return rows.map(row => {
          const mappedProduct = mapItemToSchema(row, 'products');
          mappedProduct.__typename = 'Product';
          return mappedProduct;
        });
      } finally {
        client.release();
      }
    },
    getItemsByCategoryAndHids: async (_, { category, hids }, context) => {
      const client = await pool.connect();
      try {
        const tableName = TABLE_NAMES[category];
        if (!tableName) {
          throw new Error('Invalid category');
        }
        const query = `SELECT * FROM ${tableName} WHERE hid = ANY($1)`;
        const { rows } = await client.query(query, [hids]);
        // Add category context to each item for type resolution
        return rows.map(row => {
          const mappedItem = mapItemToSchema(row, category);
          mappedItem.__typename = category === 'vehicles' ? 'Vehicle' :
            category === 'real_estate' ? 'RealEstate' : 'Product';
          return mappedItem;
        });
      } finally {
        client.release();
      }
    },
  },
  SearchResult: {
    __resolveType(obj, context, info) {
      // Check if we have a category context from the parent query
      const category = context?.category || obj.__typename;

      if (category === 'vehicles' || (obj.brand && obj.model && obj.year !== undefined)) {
        return 'Vehicle';
      }
      if (category === 'real_estate' || (obj.listing_type || obj.bedrooms !== undefined || obj.area !== undefined)) {
        return 'RealEstate';
      }
      if (category === 'products' || (obj.category && obj.title)) {
        return 'Product';
      }

      // Fallback based on object properties
      if (obj.brand && obj.model) return 'Vehicle';
      if (obj.listing_type || obj.bedrooms !== undefined) return 'RealEstate';
      if (obj.category) return 'Product';

      return null;
    }
  }
};

function mapItemToSchema(item, category) {
  if (category === 'vehicles') {
    return {
      hid: item.hid,
      category: 'vehicles',
      brand: item.brand,
      model: item.model,
      year: item.year,
      engine: item.engine,
      condition: item.condition,
      mileage_value: item.mileage_value,
      mileage_unit: item.mileage_unit,
      exterior_color: item.exterior_color,
      interior_color: item.interior_color,
      passengers: item.passengers,
      fuel_type: item.fuel_type,
      transmission: item.transmission,
      traction: item.traction,
      price: parsePriceValue(item.price_value),
      price_currency: item.price_currency,
      location: item.location,
      city: item.city,
      province: item.province,
      coordinates: item.coordinates,
      images_url: parseImages(item.images_url),
      detail_url: item.detail_url,
      accessories: item.accessories,
      source: item.source,
      created_at: item.created_at,
      updated_at: item.updated_at
    };
  } else if (category === 'real_estate') {
    return {
      hid: item.hid,
      category: 'real_estate',
      title: item.title,
      price: parsePriceValue(item.price_usd),
      listing_type: item.listing_type,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      area: isNaN(parseFloat(item.area)) ? null : parseFloat(item.area),
      location: item.location,
      coordinates: item.coordinates,
      description: item.description,
      features: item.features,
      images_url: parseImages(item.images_url),
      detail_url: item.detail_url,
      source: item.source,
      updated_at: item.updated_at
    };
  } else if (category === 'products') {
    return {
      hid: item.hid,
      title: item.title,
      category: item.category,
      brand: item.brand,
      price: parsePriceValue(item.price_value),
      price_currency: item.price_currency,
      availability: item.availability,
      images_url: parseImages(item.images_url),
      detail_url: item.detail_url,
      location: item.location,
      coordinates: item.coordinates,
      source: item.source,
      created_at: item.created_at,
      updated_at: item.updated_at
    };
  }
  return item;
}

function mapListItemToSchema(item) {
  return {
    id: item.id,
    user_id: item.user_id,
    category: item.category,
    title: item.title,
    description: item.description,
    price: item.price,
    phone_number: item.phone_number,
    location: item.location || {},
    media: Array.isArray(item.media) ? item.media : [], // Fallback if it's null
    basic_attributes: item.basic_attributes || {},
    attributes: item.attributes || {},
    status: item.status,
    boost: item.boost,
    boost_expire: item.boost_expire,
    created_at: item.created_at,
    updated_at: item.updated_at,
    is_verified: item.is_verified,
  };
}


module.exports = resolvers;