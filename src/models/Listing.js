const { DataTypes } = require('sequelize');
const { Pool } = require('pg');

// Use the same Railway database connection as ragService
const pool = new Pool({
  connectionString: process.env.LISTING_URL,
  ssl: false,
});

class Listing {
  // Get listing counts for multiple user IDs at once
  async countListingsByUserIds(userIds, status = null) {
    if (!Array.isArray(userIds) || userIds.length === 0) return {};

    let statusFilter = status ? `AND status = '${status === 'active' ? 'active' : 'hidden'}'` : '';

    const selectSQL = `
      SELECT user_id, COUNT(*) as count
      FROM ${this.tableName}
      WHERE user_id = ANY($1)
      ${statusFilter}
      GROUP BY user_id
    `;
    try {
      const result = await this.pool.query(selectSQL, [userIds]);
      // Map user_id to count
      const map = {};
      result.rows.forEach(row => { map[row.user_id] = parseInt(row.count, 10); });
      return map;
    } catch (error) {
      console.error('Error counting listings by user IDs:', error);
      throw error;
    }
  }
  constructor() {
    this.tableName = 'listings';
    this.pool = pool;
  }

  // Helper method to convert database results
  _convertResult(row) {
    if (!row) return null;
    return {
      ...row,
      price: parseFloat(row.price) || 0,
      location: typeof row.location === 'string' ? JSON.parse(row.location) : row.location,
      media: typeof row.media === 'string' ? JSON.parse(row.media) : row.media,
      attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : row.attributes,
      basic_attributes: typeof row.basic_attributes === 'string' ? JSON.parse(row.basic_attributes) : row.basic_attributes
    };
  }

  _convertResults(rows) {
    return rows.map(row => this._convertResult(row));
  }

  async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        price DECIMAL(15,2) NOT NULL,
        phone_number VARCHAR(20),
        location JSONB NOT NULL,
        media JSONB DEFAULT '[]',
        basic_attributes JSONB DEFAULT '{}',
        attributes JSONB DEFAULT '{}',
        vector vector(1536),
        status VARCHAR(50) DEFAULT 'active',
        boost INT DEFAULT 0,
        boost_expire TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_listings_category ON ${this.tableName}(category);
      CREATE INDEX IF NOT EXISTS idx_listings_user_id ON ${this.tableName}(user_id);
      CREATE INDEX IF NOT EXISTS idx_listings_status ON ${this.tableName}(status);
      CREATE INDEX IF NOT EXISTS idx_listings_price ON ${this.tableName}(price);
      CREATE INDEX IF NOT EXISTS idx_listings_phone_number ON ${this.tableName}(phone_number);
      CREATE INDEX IF NOT EXISTS idx_listings_created_at ON ${this.tableName}(created_at);
      
      -- GIN index for JSONB attributes for fast filtering
      CREATE INDEX IF NOT EXISTS idx_listings_attributes ON ${this.tableName} USING GIN (attributes);
      
      -- Vector similarity index using pgvector
      CREATE INDEX IF NOT EXISTS idx_listings_vector ON ${this.tableName} USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
    `;

    try {
      await this.pool.query(createTableSQL);
      console.log(`Table ${this.tableName} created successfully`);
      
      // Check if phone_number column exists, if not add it
      await this.ensurePhoneNumberColumn();
    } catch (error) {
      console.error(`Error creating table ${this.tableName}:`, error);
      throw error;
    }
  }



  async ensurePhoneNumberColumn() {
    try {
      // Check if phone_number column exists
      const checkColumnSQL = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'phone_number'
      `;
      
      const result = await this.pool.query(checkColumnSQL, [this.tableName]);
      
      if (result.rows.length === 0) {
        // Column doesn't exist, add it
        const addColumnSQL = `
          ALTER TABLE ${this.tableName} 
          ADD COLUMN phone_number VARCHAR(20)
        `;
        
        await this.pool.query(addColumnSQL);
        console.log(`Added phone_number column to ${this.tableName}`);
        
        // Add index for phone_number
        const addIndexSQL = `
          CREATE INDEX IF NOT EXISTS idx_listings_phone_number ON ${this.tableName}(phone_number)
        `;
        
        await this.pool.query(addIndexSQL);
        console.log(`Added phone_number index to ${this.tableName}`);
      } else {
        console.log(`phone_number column already exists in ${this.tableName}`);
      }
    } catch (error) {
      console.error(`Error ensuring phone_number column:`, error);
      // Don't throw error, just log it
    }
  }

  async create(listingData) {
    const {
      user_id,
      category,
      title,
      description,
      price,
      phone_number,
      location,
      media = [],
      attributes = {},
      basic_attributes = {},
      vector,
      status = 'active',
      boost = 0,
      is_verified
    } = listingData;

    const insertSQL = `
      INSERT INTO ${this.tableName} 
      (user_id, category, title, description, price, phone_number, location, media, attributes, basic_attributes, vector, status, boost, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      user_id,
      category,
      title,
      description,
      price,
      phone_number,
      JSON.stringify(location),
      JSON.stringify(media),
      JSON.stringify(attributes),
      JSON.stringify(basic_attributes),
      vector ? `[${vector.join(',')}]` : null, // Convert array to pgvector format
      status,
      boost,
      is_verified
    ];

    try {
      const result = await this.pool.query(insertSQL, values);
      return this._convertResult(result.rows[0]);
    } catch (error) {
      console.error('Error creating listing:', error);
      throw error;
    }
  }

  async findById(id) {
    const selectSQL = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    try {
      const result = await this.pool.query(selectSQL, [id]);
      return this._convertResult(result.rows[0]);
    } catch (error) {
      console.error('Error finding listing by ID:', error);
      throw error;
    }
  }

  async findByUserId(userId, limit = 20, offset = 0, userVerifiedStatus = null) {
    // If user is not verified, only show active listings (hide the ones beyond limit)
    const statusFilter = (userVerifiedStatus && userVerifiedStatus !== 'VERIFIED') ? ` AND status = 'active'` : '';
    
    const selectSQL = `
      SELECT * FROM ${this.tableName} 
      WHERE user_id = $1
      ${statusFilter}
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await this.pool.query(selectSQL, [userId, limit, offset]);
      return this._convertResults(result.rows);
    } catch (error) {
      console.error('Error finding listings by user ID:', error);
      throw error;
    }
  }

  async countListingByUserId(userId, userVerifiedStatus = null) {
    // If user is not verified, only count active listings (hide the ones beyond limit)
    const statusFilter = (userVerifiedStatus && userVerifiedStatus !== 'VERIFIED') ? ` AND status = 'active'` : '';
    
    const selectSQL = `
      SELECT COUNT(*) FROM ${this.tableName} 
      WHERE user_id = $1
      ${statusFilter}
    `;
    
    try {
      const result = await this.pool.query(selectSQL, [userId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error counting listings by user ID:', error);
      throw error;
    }
  }

  async findByCategory(category, limit = 20, offset = 0) {
    const selectSQL = `
      SELECT * FROM ${this.tableName} 
      WHERE category = $1 AND status = 'active'
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    try {
      const result = await this.pool.query(selectSQL, [category, limit, offset]);
      return this._convertResults(result.rows);
    } catch (error) {
      console.error('Error finding listings by category:', error);
      throw error;
    }
  }

  async vectorSearch(vector, limit = 10, category = null) {
    let selectSQL = `
      SELECT *, 
        (vector <=> $1) as distance
      FROM ${this.tableName} 
      WHERE status = 'active'
    `;
    
    const vectorStr = `[${vector.join(',')}]`; // Convert array to pgvector format
    const values = [vectorStr];
    let paramIndex = 2;

    if (category) {
      selectSQL += ` AND category = $${paramIndex}`;
      values.push(category);
      paramIndex++;
    }

    selectSQL += `
      ORDER BY distance ASC 
      LIMIT $${paramIndex}
    `;
    values.push(limit);

    try {
      const result = await this.pool.query(selectSQL, values);
      return this._convertResults(result.rows);
    } catch (error) {
      console.error('Error performing vector search:', error);
      throw error;
    }
  }

  async update(id, updateData) {
    const fields = Object.keys(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const updateSQL = `
      UPDATE ${this.tableName} 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const values = [id, ...fields.map(field => {
      if (field === 'vector' && updateData[field]) {
        return `[${updateData[field].join(',')}]`; // Convert array to pgvector format
      }
      if (typeof updateData[field] === 'object') {
        return JSON.stringify(updateData[field]);
      }
      return updateData[field];
    })];

    try {
      const result = await this.pool.query(updateSQL, values);
      return this._convertResult(result.rows[0]);
    } catch (error) {
      console.error('Error updating listing:', error);
      throw error;
    }
  }

  async delete(id) {
    const deleteSQL = `
      DELETE FROM ${this.tableName} WHERE id = $1
    `;
    try {
      const result = await this.pool.query(deleteSQL, [id]);
      return this._convertResult(result.rows[0]);
    } catch (error) {
      console.error('Error deleting listing:', error);
      throw error;
    }
  }

  async deleteByUserId(userId) {
    try {
      const deleteSQL = `
        DELETE FROM ${this.tableName} WHERE user_id = $1
      `;
      const result = await this.pool.query(deleteSQL, [userId]);
      console.log(`Deleted all listings for user ${userId}`);
      return result.rowCount;
    } catch (error) {
      console.error('Error deleting listings by user ID:', error);
      throw error;
    }
  }

  async searchByAttributes(category, filters, limit = 20, offset = 0) {
    let selectSQL = `
      SELECT * FROM ${this.tableName} 
      WHERE category = $1 AND status = 'active'
    `;
    
    const values = [category];
    let paramIndex = 2;

    // Add attribute filters
    Object.entries(filters).forEach(([key, value]) => {
      selectSQL += ` AND attributes->>'${key}' = $${paramIndex}`;
      values.push(value);
      paramIndex++;
    });

    selectSQL += `
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(limit, offset);

    try {
      const result = await this.pool.query(selectSQL, values);
      return this._convertResults(result.rows);
    } catch (error) {
      console.error('Error searching by attributes:', error);
      throw error;
    }
  }


  async updateAAllListingsVerifiedbadgeByUser(userId, isVerified = true) {
    try{
      const updateSQL = `
        UPDATE ${this.tableName} 
        SET is_verified = $2
        WHERE user_id = $1
      `;

      await this.pool.query(updateSQL, [userId, isVerified]);
      
      console.log(`Updated verification badge for user ${userId}`);
    }catch(error){
      console.error('Error updating all listings status:', error);
      throw error;
    }
  }

  async hideListingsBeyondLimit(userId, limit = 5) {
    try {
      // First, get all listings for the user ordered by creation date
      const selectSQL = `
        SELECT id, created_at 
        FROM ${this.tableName} 
        WHERE user_id = $1 
        ORDER BY created_at ASC
      `;
      
      const result = await this.pool.query(selectSQL, [userId]);
      const listings = result.rows;
      
      if (listings.length <= limit) {
        console.log(`User ${userId} has ${listings.length} listings, no need to hide any`);
        return { hidden: 0, total: listings.length };
      }
      
      // Get IDs of listings beyond the limit (keep first 5, hide the rest)
      const listingsToHide = listings.slice(limit).map(listing => listing.id);
      
      if (listingsToHide.length === 0) {
        return { hidden: 0, total: listings.length };
      }
      
      // Hide the listings by setting status to 'hidden'
      const updateSQL = `
        UPDATE ${this.tableName} 
        SET status = 'hidden'
        WHERE id = ANY($1) AND status = 'active'
      `;
      
      await this.pool.query(updateSQL, [listingsToHide]);
      
      console.log(`Hidden ${listingsToHide.length} listings for user ${userId} (beyond limit of ${limit})`);
      
      return { 
        hidden: listingsToHide.length, 
        total: listings.length,
        hiddenIds: listingsToHide
      };
    } catch (error) {
      console.error('Error hiding listings beyond limit:', error);
      throw error;
    }
  }

  async showAllListingsForUser(userId) {
    try {
      const updateSQL = `
        UPDATE ${this.tableName} 
        SET status = 'active'
        WHERE user_id = $1 AND status = 'hidden'
      `;
      
      const result = await this.pool.query(updateSQL, [userId]);
      
      console.log(`Restored ${result.rowCount} hidden listings for user ${userId}`);
      
      return { restored: result.rowCount };
    } catch (error) {
      console.error('Error showing all listings for user:', error);
      throw error;
    }
  }

    async showLimitListingsForUser(userId, limit = 5) {
    try {
      const updateSQL = `
        UPDATE ${this.tableName} 
        SET status = 'active'
        WHERE id IN (
            SELECT id
            FROM ${this.tableName}
            WHERE user_id = $1
            ORDER BY created_at ASC
            LIMIT $2
          )
      `;
      
      const result = await this.pool.query(updateSQL, [userId, limit]);
      
      console.log(`Activated first ${result.rowCount} listings for user ${userId}`);
      
      return { restored: result.rowCount };
    } catch (error) {
      console.error('Error showing all listings for user:', error);
      throw error;
    }
  }

  async UpdateBoostingInformation(listingId, boostScore, expires_at, userId) {
    const updateSQL = `
      UPDATE ${this.tableName} 
      SET boost = $2, boost_expire = $3
      WHERE id = $1 AND user_id = $4
      RETURNING *
    `;

    try {
      const result = await this.pool.query(updateSQL, [listingId, boostScore, expires_at, userId]);
      return this._convertResult(result.rows[0]);
    } catch (error) {
      console.error('Error updating boosting information:', error);
      throw error;
    }
  }

  async getAllListings(offset, limit) {
    const selectSQL = `
      SELECT 
        id, 
        user_id, 
        category, 
        title, 
        description, 
        price, 
        phone_number, 
        location, 
        media, 
        basic_attributes, 
        attributes, 
        status, 
        boost, 
        boost_expire, 
        created_at, 
        updated_at
      FROM ${this.tableName}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const countSQL = `SELECT COUNT(*) FROM ${this.tableName}`;
    try {
      const [result, countResult] = await Promise.all([
        this.pool.query(selectSQL, [limit, offset]),
        this.pool.query(countSQL)
      ]);
      const count = parseInt(countResult.rows[0].count, 10);
      return {
        count,
        rows: this._convertResults(result.rows)
      };
    } catch (error) {
      console.error('Error fetching all listings:', error);
      throw error;
    }
  }

  async getBoostedListings() {
    const selectSQL = `
      SELECT 
        id, 
        user_id, 
        category, 
        title, 
        description, 
        price, 
        phone_number, 
        location, 
        media, 
        basic_attributes, 
        attributes, 
        status, 
        boost, 
        boost_expire, 
        created_at, 
        updated_at
      FROM ${this.tableName}
      WHERE boost > 0 AND boost_expire > CURRENT_TIMESTAMP AND status = 'active'
      ORDER BY boost_expire DESC
    `;

    try {
      const result = await this.pool.query(selectSQL)
      return this._convertResults(result.rows);
    } catch (error) {
      console.error('Error fetching boosted listings:', error);
      throw error;
    }
  }
}

module.exports = new Listing();