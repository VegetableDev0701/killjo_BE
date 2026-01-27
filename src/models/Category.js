const { Pool } = require('pg');
const  { defaultCategories } = require('../data/categoryData');


// Use the same Railway database connection as ragService
const pool = new Pool({
  connectionString: process.env.LISTING_URL,
  ssl: false, // Disable SSL for this connection
});

class Category {
  constructor() {
    this.tableName = 'categories';
    this.pool = pool;
  }

  async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_key VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        description TEXT,
        icon VARCHAR(100),
        color VARCHAR(7),
        basic_attributes JSONB DEFAULT '{}',
        attributes JSONB NOT NULL,
        search_fields JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_categories_active ON ${this.tableName}(is_active);
      CREATE INDEX IF NOT EXISTS idx_categories_sort ON ${this.tableName}(sort_order);
      CREATE INDEX IF NOT EXISTS idx_categories_key ON ${this.tableName}(category_key);
    `;

    try {
      await this.pool.query(createTableSQL);
      console.log(`Table ${this.tableName} created successfully`);
    } catch (error) {
      console.error(`Error creating table ${this.tableName}:`, error);
      throw error;
    }
  }

  async updateCategoriesDatabase() {
    console.log('🔄 Starting category synchronization...');

    try {
      // First, get existing categories to see what's already there
      const existingCategories = await this.findAll();
      const existingKeys = existingCategories.map(cat => cat.category_key);
      
      let addedCount = 0;
      let errorCount = 0;
      
      // Process each default category
      for (const category of defaultCategories) {
        try {
          if (existingKeys.includes(category.category_key)) {
            // Update existing category
            await this.update(category.category_key, category);
          } else {
            // Create new category
            await this.create(category);
            addedCount++;
            console.log(`➕ Added new category: ${category.category_key}`);
          }
        } catch (categoryError) {
          errorCount++;
          console.error(`❌ Error processing category ${category.category_key}:`, categoryError.message);
        }
      }
      
      // Verify final count
      const finalCategories = await this.findAll();
      const finalKeys = finalCategories.map(cat => cat.category_key);
      
      if (finalCategories.length === defaultCategories.length) {
        console.log('📋 Available categories:', finalKeys.join(', '));
      } else {
        console.log('⚠️  WARNING: Not all categories were synced successfully');
        const missingKeys = defaultCategories
          .map(cat => cat.category_key)
          .filter(key => !finalKeys.includes(key));
        console.log('❌ Missing categories:', missingKeys.join(', '));
      }
      
      return {
        success: finalCategories.length === defaultCategories.length,
        added: addedCount,
        errors: errorCount,
      };
    } catch (error) {
      console.error('❌ Critical error during category sync:', error);
      throw error;
    }
  }

  async create(categoryData) {
    const {
      category_key,
      display_name,
      description,
      icon,
      color,
      basic_attributes,
      attributes,
      search_fields = [],
      is_active = true,
      sort_order = 0
    } = categoryData;

    const insertSQL = `
      INSERT INTO ${this.tableName} 
      (category_key, display_name, description, icon, color, attributes, search_fields, is_active, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (category_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color,
        attributes = EXCLUDED.attributes,
        search_fields = EXCLUDED.search_fields,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      category_key,
      display_name,
      description,
      icon,
      color,
      JSON.stringify(attributes),
      JSON.stringify(search_fields),
      is_active,
      sort_order
    ];

    try {
      const result = await this.pool.query(insertSQL, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async findAll() {
    const selectSQL = `
      SELECT * FROM ${this.tableName} 
      WHERE is_active = true 
      ORDER BY sort_order ASC, display_name ASC
    `;
    try {
      const result = await this.pool.query(selectSQL);
      return result.rows;
    } catch (error) {
      console.error('Error finding all categories:', error);
      throw error;
    }
  }

  async findByKey(categoryKey) {
    const selectSQL = `SELECT * FROM ${this.tableName} WHERE category_key = $1 AND is_active = true`;
    try {
      const result = await this.pool.query(selectSQL, [categoryKey]);
      return result.rows[0];
    } catch (error) {
      console.error('Error finding category by key:', error);
      throw error;
    }
  }

  async update(categoryKey, updateData) {
    const fields = Object.keys(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const updateSQL = `
      UPDATE ${this.tableName} 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE category_key = $1
      RETURNING *
    `;

    const values = [categoryKey, ...fields.map(field => {
      if (typeof updateData[field] === 'object') {
        return JSON.stringify(updateData[field]);
      }
      return updateData[field];
    })];

    try {
      const result = await this.pool.query(updateSQL, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async delete(categoryKey) {
    const deleteSQL = `
      UPDATE ${this.tableName} 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE category_key = $1
      RETURNING *
    `;
    try {
      const result = await this.pool.query(deleteSQL, [categoryKey]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  // Check if all required categories are present
  async validateCategories() {
    const expectedCategories = [
      'vehicles', 'real_estate', 'electronics', 'fashion', 'furniture',
      'books', 'sports', 'services', 'pets', 'jobs',
      'collectibles', 'health', 'education', 'events', 'tools'
    ];
    
    const existingCategories = await this.findAll();
    const existingKeys = existingCategories.map(cat => cat.category_key);
    
    const missingCategories = expectedCategories.filter(key => !existingKeys.includes(key));
    
    return {
      isValid: missingCategories.length === 0,
      total: existingCategories.length,
      expected: expectedCategories.length,
      missing: missingCategories
    };
  }

  async getAttributes(categoryKey) {
    const category = await this.findByKey(categoryKey);
    if (!category) {
      throw new Error(`Category '${categoryKey}' not found`);
    }
    return category.attributes;
  }

  validateAttributes(categoryKey, attributes) {
    let category = defaultCategories.find(obj => obj.category_key === categoryKey);
    if (!category) {
      return { isValid: false, errors: [`Category '${categoryKey}' not found`] };
    }

    const schemaAttributes = category.attributes;
    const errors = [];

    // Check required fields
    for (const [fieldName, fieldConfig] of Object.entries(schemaAttributes)) {
      if (fieldConfig.required && (!attributes[fieldName] || attributes[fieldName] === '')) {
        errors.push(`${fieldName} is required`);
        continue;
      }

      if (attributes[fieldName] !== undefined) {
        let value = attributes[fieldName];
        
        // Type validation
        switch (fieldConfig.type) {
          case 'string':
            if (typeof value !== 'string') {
              errors.push(`${fieldName} must be a string`);
            }
            break;
          case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
              errors.push(`${fieldName} must be a number`);
            }
            if (fieldConfig.min !== undefined && value < fieldConfig.min) {
              errors.push(`${fieldName} must be at least ${fieldConfig.min}`);
            }
            if (fieldConfig.max !== undefined && value > fieldConfig.max) {
              errors.push(`${fieldName} must be at most ${fieldConfig.max}`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              errors.push(`${fieldName} must be a boolean`);
            }
            break;
          case 'enum':
            // const options = fieldConfig.options?.map(opt => opt.es);
            // if (options && !options.includes(value)) {
            //   errors.push(`${fieldName} must be one of: ${options.join(', ')}`);
            // }
            break;
          case 'array':
            if (!Array.isArray(value)) {
              errors.push(`${fieldName} must be an array`);
            } else {
              // const options = fieldConfig.options?.map(opt => opt.es);
              // try {
              //   const allExist = value.every(item => options.includes(item));
              //   if (!allExist) errors.push(`all items in ${fieldName} must be from [${options.join(', ')}]`);
              // } catch (err) {
              //   errors.push(`each item in ${fieldName} array must be a string`);
              // }
            }
            break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new Category(); 