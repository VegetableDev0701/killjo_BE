const {defaultCategories} = require('../data/categoryData');
let pipeline;

async function getPipeline() {
  if (!pipeline) {
    const mod = await import('@xenova/transformers');
    pipeline = mod.pipeline;
  }
  return pipeline;
}

class EmbeddingService {
  constructor() {
    this.model = null;
    this.tokenizer = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing Xenova all-mini-llm v2 embedding model...');
      
      // Load the model and tokenizer
      const pipelineFunc = await getPipeline();
      this.model = await pipelineFunc('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.isInitialized = true;
      
      console.log('Embedding model initialized successfully');
    } catch (error) {
      console.error('Error initializing embedding model:', error);
      throw error;
    }
  }

  async generateEmbedding(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Clean and prepare the text
      const cleanText = this.prepareText(text);
      
      // Generate embedding
      const result = await this.model(cleanText, {
        pooling: 'mean',
        normalize: true
      });
      
      // Convert to array of floats
      const embedding = Array.from(result.data);
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  getEmbeddingTextForListing(data) {
    let category = defaultCategories.find(obj => obj.category_key === data.category);
    const cAttr = category.attributes;
    if (!category) return null;

    const arr = [];
    const attr = data.attributes;

    if (data.title) arr.push(data.title);

    if (category.basic_attributes['listing_type']) arr.push(data.basic_attributes['listing_type']);

    // Ordered by priority and organise Wordings
    let attrNames = ['condition', 'color', 'brand', 'model', 'property_type', 'listing_type', 'era', 'rarity', 'category', 'title', 'author', 'sport', 'service_type',
      'breed', 'animal_type', 'job_type', 'industry', 'format', 'level', 'subject', 'event_type', 'part_type'];

    for (const attrName of attrNames) {
      if (cAttr[attrName] && attr[attrName]?.length > 0) arr.push(attr[attrName]);
    }

    if (data.description) arr.push(data.description);

    // Orderd in a way that the final string would make better sense.
    attrNames = [
      'transmission', 'body_type', 'engine_size', 'fuel_type', 'furnished', 'view', 'location_type', 'processor', 'ram', 'storage', 'warranty', 'compatible_with',
      'authenticity', 'style', 'season', 'gender', 'size', 'flavor', 'package_size', 'nutrition_facts', 'storage_instructions', 'material', 'power_consumption', 'room',
      'language', 'genre', 'format', 'publisher', 'edition', 'usage_level', 'weight', 'service_area', 'availability', 'certification', 'reason_for_sale', 'special_needs',
      'salary_type', 'start_date', 'experience_level', 'education_level', 'dimensions', 'materials', 'provenance', 'storage_condition', 'skin_type', 'usage_instructions', 'ingredients',
      'prerequisites', 'instructor_qualifications', 'location', 'duration', 'schedule', 'refund_policy', 'age_restriction', 'dress_code', 'ticket_type', 'seating_section', 'venue', 'city', 'power_source', 'voltage', 'battery_type', 'dimensions'
    ];
    for (const attrName of attrNames) {
      if (cAttr[attrName] && attr[attrName]?.length > 0) arr.push(attr[attrName]);
    }

    // Boolean Attributes
    attrNames = [
      'original_box', 'receipt', 'delivery_available', 'signed', 'vaccinated', 'neutered', 'microchipped', 'trained', 'vegan', 'organic', 'cruelty_free', 'prescription_required',
      'materials_included', 'certificate', 'transferable', 'digital_ticket', 'parking_included', 'food_beverage', 'rental_available', 'delivery_available'
    ];
    for (const attrName of attrNames) {
      if (cAttr[attrName] && attr[attrName] === true) {
        const name = attrName.replace(/_/g, ' ');
        arr.push(name);
      }
    }

    // Add Array data
    attrNames = [
      'features', 'amenities', 'connectivity', 'accessories', 'dietary_info', 'languages', 'payment_methods', 'skills_required', 'benefits', 'skin_concerns',
      'accessories_included', 'safety_features'
    ];
    for (const attrName of attrNames) {
      if (cAttr[attrName] && attr[attrName]?.length > 0) {
        const values = [];
        for (const val of attr[attrName]) {
          const underScrRemoved = val.replace(/_/g, ' ');
          values.push(underScrRemoved);
        }
        const list =  values.join(', ');

        const name = attrName.replace(/_/g, ' ');
        const txt = name + ' are [' + list + '] ';
        arr.push(txt);
      }
    }

    //embedding location details
    const location = data.location;
    if (location) {
      if (location.display_name) arr.push(location.display_name);
      else {
        if (location.street) arr.push(location.street);
        if (location.city) arr.push(location.city);
        if (location.state) arr.push(location.state);
      }
    } else if (attr.location) {
      arr.push(attr.location);
    }

    return arr.join(' ');
  }

  async generateListingEmbedding(listingData) {
    const {
      title = '',
      description = '',
      attributes = {},
      category = '',
      location = {},
      phone_number = ''
    } = listingData;

    // Create a comprehensive text representation for embedding
    const textParts = [
      title,
      description,
      category,
      // Include phone number for contact search
      phone_number,
      // Include location display name for better search results
      location.display_name || '',
      location.city || '',
      location.state || '',
      location.street || '',
      // Include all attribute values as text
      ...Object.values(attributes).map(value => {
        if (Array.isArray(value)) {
          return value.join(' ');
        }
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value);
        }
        return String(value);
      })
    ];

    const combinedText = textParts.filter(part => part && part.trim()).join(' ');
    
    return await this.generateEmbedding(combinedText);
  }

  prepareText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Clean and normalize text
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 512); // Limit length for performance
  }
  // Get model info
  getModelInfo() {
    return {
      name: 'Xenova/all-MiniLM-L6-v2',
      dimension: 384, // Standard dimension for this model
      isInitialized: this.isInitialized
    };
  }
}

// Export singleton instance
module.exports = new EmbeddingService(); 