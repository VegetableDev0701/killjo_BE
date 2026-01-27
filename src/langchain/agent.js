const { OpenAI } = require('openai');
const { executeRawQuery } = require('../db');
const { detectLanguage } = require('../utils/languageDetector');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced in-memory cache with longer expiry time
const queryCache = new Map();
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes (increased from 5)
const RESPONSE_CACHE = new Map(); // Cache for natural language responses

// Set timeout for OpenAI requests
const OPENAI_TIMEOUT = 5000; // Reduced from 15s to 5s

/**
 * Detect vehicle color from query in both English and Spanish
 * @param {string} query - The user query
 * @returns {string|null} - Detected color or null
 */
function detectVehicleColor(query) {
  const normalizedQuery = query.toLowerCase();
  
  // Common colors in English and Spanish with variations
  const colorMap = {
    // Basic colors with variations
    'black': ['black', 'negro', 'negra', 'oscuro', 'oscura', 'midnight'],
    'white': ['white', 'blanco', 'blanca', 'pearl', 'polar', 'ivory', 'perla'],
    'red': ['red', 'rojo', 'roja', 'burgundy', 'crimson', 'vermillion', 'scarlet', 'carmesí'],
    'blue': ['blue', 'azul', 'navy', 'cobalt', 'turquoise', 'turquesa', 'celeste'],
    'green': ['green', 'verde', 'olive', 'jade', 'emerald', 'lime', 'forest', 'esmeralda'],
    'yellow': ['yellow', 'amarillo', 'amarilla', 'gold', 'oro', 'dorado', 'amber', 'ámbar'],
    'orange': ['orange', 'naranja', 'anaranjado', 'amber', 'ámbar'],
    'purple': ['purple', 'violet', 'púrpura', 'violeta', 'morado', 'lavender', 'lavanda'],
    'pink': ['pink', 'rosa', 'rosado', 'rosada', 'fuschia', 'magenta'],
    'brown': ['brown', 'café', 'marrón', 'marron', 'chocolate', 'tan', 'beige', 'khaki', 'caqui'],
    'gray': ['gray', 'grey', 'gris', 'silver', 'plata', 'plateado', 'charcoal'],
    
    // Metallic variations
    'silver': ['silver', 'plata', 'plateado', 'argent'],
    'bronze': ['bronze', 'bronce'],
    'champagne': ['champagne', 'champán', 'champan'],
    
    // Custom car colors
    'burgundy': ['burgundy', 'wine', 'vino', 'bordeaux', 'burdeos'],
    'teal': ['teal', 'turquoise', 'turquesa'],
    'cream': ['cream', 'crema', 'beige'],
    'navy': ['navy', 'navy blue', 'azul marino'],
    'charcoal': ['charcoal', 'carbon', 'carbón', 'graphite', 'grafito'],
    
    // Two-tone descriptions
    'two-tone': ['two-tone', 'two tone', 'bi-color', 'bicolor', 'dos colores', 'dos tonos']
  };
  
  // Check for color mentions in the query
  for (const [standardColor, variations] of Object.entries(colorMap)) {
    for (const colorTerm of variations) {
      // Look for the color term as a whole word
      if (new RegExp(`\\b${colorTerm}\\b`).test(normalizedQuery)) {
        return standardColor;
      }
    }
  }
  
  // Descriptive terms that might indicate colors
  const descriptiveColors = {
    'metallic': 'metallic',
    'metálico': 'metallic',
    'matte': 'matte',
    'mate': 'matte',
    'gloss': 'glossy',
    'brillante': 'glossy',
    'pearl': 'pearl',
    'perla': 'pearl',
    'iridescent': 'iridescent',
    'iridiscente': 'iridescent'
  };
  
  // Check for descriptive color terms
  for (const [term, description] of Object.entries(descriptiveColors)) {
    if (normalizedQuery.includes(term)) {
      // Find if there's also a standard color
      for (const [standardColor, variations] of Object.entries(colorMap)) {
        for (const colorTerm of variations) {
          if (new RegExp(`\\b${colorTerm}\\b`).test(normalizedQuery)) {
            return `${description} ${standardColor}`;
          }
        }
      }
      
      // If no standard color found with descriptor
      return description;
    }
  }
  
  return null;
}

/**
 * Extracts and refines structured parameters from a vehicle query
 * @param {string} query - The user query
 * @param {string} language - The detected language ('es' or 'en')
 * @returns {Promise<Object>} - Structured parameters
 */
async function extractVehicleParameters(query, language) {
  try {
    // Create a parameter extraction prompt
    const prompt = `
    You are a vehicle database expert. Extract specific parameters from this query:
    
    QUERY: "${query}"
    LANGUAGE: ${language === 'es' ? 'Spanish' : 'English'}
    
    INSTRUCTIONS:
    1. Analyze query for vehicle specifications
    2. Extract all relevant parameters
    3. Pay special attention to TECHNICAL PARAMETERS such as cylinders, engine size, etc.
    4. Parse TECHNICAL PARAMETERS correctly (e.g., "8 cylinder" should be saved as cylinders: 8)
    5. For ambiguous terms, include alternatives (e.g., "Benz" → brand: "Mercedes")
    6. IMPORTANT: Always set location to "Dominican Republic" unless explicitly mentioned otherwise
    7. IMPORTANT: For colors, recognize both standard colors and descriptive color terms:
       - Standard colors: black, white, red, blue, green, yellow, orange, purple, pink, brown, gray, silver
       - Accept color variations: burgundy, wine, pearl white, metallic blue, matte black, etc.
       - Spanish equivalents: negro, blanco, rojo, azul, verde, amarillo, naranja, morado, rosa, marrón, gris, plata
    
    PARAMETERS TO EXTRACT (include ONLY those mentioned):
    - brand: Car manufacturer
    - model: Specific model name
    - year_range: Min and max years
    - price_range: Min and max price
    - vehicle_type: Category (SUV, sedan, etc.)
    - engine_specs: {
        cylinders: number of cylinders (IMPORTANT for queries like "8 cylinders car")
        displacement: Engine size (e.g. "2.0L")
        type: Engine type (e.g. "V6", "turbo")
      }
    - transmission: Manual/automatic
    - fuel_type: Gasoline/diesel/etc.
    - color: Vehicle color (normalized to a standard color name)
    - condition: New/used
    - location: Geographic location (Always set to "Dominican Republic" unless specified otherwise)
    
    RETURN JSON ONLY with this structure:
    {
      "parameters": {
        "brand": string or [string],
        "model": string or [string],
        "year_range": {"min": number, "max": number},
        "price_range": {"min": number, "max": number},
        "vehicle_type": string or [string],
        "engine_specs": {
          "cylinders": number,
          "displacement": string,
          "type": string
        },
        "transmission": string,
        "fuel_type": string,
        "color": string,
        "condition": string,
        "location": string
      },
      "query_type": "technical" or "general",
      "is_technical_search": boolean (true if query mentions engine specs)
    }`;
    
    // Set timeout for faster response
    const controllerTimeout = new AbortController();
    const timeoutId = setTimeout(() => controllerTimeout.abort(), 5000);
    
    try {
      // Call the AI to extract parameters
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Use the fastest model
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: query }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 350,
        signal: controllerTimeout.signal
      });
      
      clearTimeout(timeoutId);
      
      // Parse the response
      const result = JSON.parse(response.choices[0].message.content);
      
      // Ensure Dominican Republic is set as default location
      if (result && result.parameters) {
        if (!result.parameters.location) {
          result.parameters.location = "Dominican Republic";
        }
        
        // If color wasn't found by AI extraction but we can detect it
        if (!result.parameters.color) {
          const detectedColor = detectVehicleColor(query);
          if (detectedColor) {
            result.parameters.color = detectedColor;
          }
        }
      }
      
      console.log('Extracted vehicle parameters:', result);
      return result;
    } catch (timeoutError) {
      clearTimeout(timeoutId);
      console.error('Parameter extraction timed out, using fallback:', timeoutError);
      
      // Create minimal parameters from the query for fallback
      return createFallbackParameters(query, language);
    }
  } catch (error) {
    console.error('Error extracting vehicle parameters:', error);
    // Fall back to simple extraction
    return createFallbackParameters(query, language);
  }
}

/**
 * Create fallback parameters when AI extraction fails
 * @param {string} query - The user query
 * @param {string} language - The detected language
 * @returns {Object} - Simple extracted parameters
 */
function createFallbackParameters(query, language) {
  // Simple regex-based extraction for common brands and models
  const normalizedQuery = query.toLowerCase();
  
  // Extract potential brand
  let brand = null;
  const commonBrands = [
    'toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'bmw', 
    'mercedes', 'audi', 'hyundai', 'kia', 'mazda', 'lexus'
  ];
  
  for (const b of commonBrands) {
    if (normalizedQuery.includes(b)) {
      brand = b;
      break;
    }
  }
  
  // Extract common models
  const toyotaModels = ['corolla', 'camry', 'rav4', 'hilux', 'tacoma', 'revo'];
  const hondaModels = ['civic', 'accord', 'cr-v', 'pilot'];
  const fordModels = ['fusion', 'mustang', 'explorer', 'f-150'];
  
  let model = null;
  
  if (brand === 'toyota') {
    for (const m of toyotaModels) {
      if (normalizedQuery.includes(m)) {
        model = m;
        break;
      }
    }
  } else if (brand === 'honda') {
    for (const m of hondaModels) {
      if (normalizedQuery.includes(m)) {
        model = m;
        break;
      }
    }
  } else if (brand === 'ford') {
    for (const m of fordModels) {
      if (normalizedQuery.includes(m)) {
        model = m;
        break;
      }
    }
  }
  
  // Create basic parameters
  const parameters = {};
  if (brand) parameters.brand = brand;
  if (model) parameters.model = model;
  
  // Detect vehicle color
  const color = detectVehicleColor(query);
  if (color) parameters.color = color;
  
  // Always add Dominican Republic as location
  parameters.location = "Dominican Republic";
  
  // Check for technical terms
  const isTechnical = normalizedQuery.includes('cylinder') || 
                     normalizedQuery.includes('cilindro') ||
                     normalizedQuery.includes('engine') ||
                     normalizedQuery.includes('motor');
  
  return {
    parameters: parameters,
    query_type: isTechnical ? "technical" : "general",
    is_technical_search: isTechnical
  };
}

/**
 * Build an optimized SQL query based on extracted parameters
 * @param {Object} params - The extracted parameters
 * @returns {string} - SQL query for vehicle search
 */
function buildOptimizedSqlQuery(params) {
  const conditions = [];
  const parameters = params.parameters || {};
  
  // Handle brand
  if (parameters.brand) {
    if (Array.isArray(parameters.brand)) {
      const brandConditions = parameters.brand.map(brand => `brand ILIKE '%${brand}%'`);
      conditions.push(`(${brandConditions.join(' OR ')})`);
    } else {
      conditions.push(`brand ILIKE '%${parameters.brand}%'`);
    }
  }
  
  // Handle model
  if (parameters.model) {
    if (Array.isArray(parameters.model)) {
      const modelConditions = parameters.model.map(model => 
        `(model ILIKE '%${model}%' OR similarity(model, '${model}') > 0.4)`
      );
      conditions.push(`(${modelConditions.join(' OR ')})`);
    } else {
      conditions.push(`(model ILIKE '%${parameters.model}%' OR similarity(model, '${parameters.model}') > 0.4)`);
    }
  }
  
  // Handle year range
  if (parameters.year_range) {
    if (parameters.year_range.min) {
      conditions.push(`year::integer >= ${parameters.year_range.min}`);
    }
    if (parameters.year_range.max) {
      conditions.push(`year::integer <= ${parameters.year_range.max}`);
    }
  }
  
  // Handle price range
  if (parameters.price_range) {
    if (parameters.price_range.min) {
      conditions.push(`REPLACE(price_value, ',', '')::numeric >= ${parameters.price_range.min}`);
    }
    if (parameters.price_range.max) {
      conditions.push(`REPLACE(price_value, ',', '')::numeric <= ${parameters.price_range.max}`);
    }
  }
  
  // Handle vehicle type
  if (parameters.vehicle_type) {
    if (Array.isArray(parameters.vehicle_type)) {
      const typeConditions = parameters.vehicle_type.map(type => `model ILIKE '%${type}%'`);
      conditions.push(`(${typeConditions.join(' OR ')})`);
    } else {
      conditions.push(`model ILIKE '%${parameters.vehicle_type}%'`);
    }
  }
  
  // Handle engine specifications - IMPORTANT for technical queries
  if (parameters.engine_specs) {
    // Handle cylinders - this is what was missing previously
    if (parameters.engine_specs.cylinders) {
      // Search for cylinders in the engine field, not in model or brand
      const cylinders = parameters.engine_specs.cylinders;
      conditions.push(`(engine ILIKE '%${cylinders}%cylinder%' OR engine ILIKE '%${cylinders}%cilindro%' OR engine ILIKE '%V${cylinders}%')`);
    }
    
    // Handle displacement
    if (parameters.engine_specs.displacement) {
      conditions.push(`engine ILIKE '%${parameters.engine_specs.displacement}%'`);
    }
    
    // Handle engine type
    if (parameters.engine_specs.type) {
      conditions.push(`engine ILIKE '%${parameters.engine_specs.type}%'`);
    }
  }
  
  // Handle transmission
  if (parameters.transmission) {
    conditions.push(`transmission ILIKE '%${parameters.transmission}%'`);
  }
  
  // Handle fuel type
  if (parameters.fuel_type) {
    conditions.push(`fuel ILIKE '%${parameters.fuel_type}%'`);
  }
  
  // Handle color - search in exterior field with variations
  if (parameters.color) {
    // Get the base color (remove variations like "metallic", "pearl", etc.)
    const baseColor = parameters.color.split(/\s+/).pop();
    
    // Map standard colors to variations for the SQL query
    const colorVariations = {
      'black': '(exterior ILIKE \'%black%\' OR exterior ILIKE \'%negro%\' OR exterior ILIKE \'%negra%\')',
      'white': '(exterior ILIKE \'%white%\' OR exterior ILIKE \'%blanco%\' OR exterior ILIKE \'%blanca%\')',
      'red': '(exterior ILIKE \'%red%\' OR exterior ILIKE \'%rojo%\' OR exterior ILIKE \'%roja%\')',
      'blue': '(exterior ILIKE \'%blue%\' OR exterior ILIKE \'%azul%\')',
      'green': '(exterior ILIKE \'%green%\' OR exterior ILIKE \'%verde%\')',
      'yellow': '(exterior ILIKE \'%yellow%\' OR exterior ILIKE \'%amarillo%\' OR exterior ILIKE \'%amarilla%\')',
      'orange': '(exterior ILIKE \'%orange%\' OR exterior ILIKE \'%naranja%\')',
      'purple': '(exterior ILIKE \'%purple%\' OR exterior ILIKE \'%morado%\' OR exterior ILIKE \'%púrpura%\')',
      'pink': '(exterior ILIKE \'%pink%\' OR exterior ILIKE \'%rosa%\')',
      'brown': '(exterior ILIKE \'%brown%\' OR exterior ILIKE \'%café%\' OR exterior ILIKE \'%marrón%\')',
      'gray': '(exterior ILIKE \'%gray%\' OR exterior ILIKE \'%grey%\' OR exterior ILIKE \'%gris%\')',
      'silver': '(exterior ILIKE \'%silver%\' OR exterior ILIKE \'%plata%\')',
      'burgundy': '(exterior ILIKE \'%burgundy%\' OR exterior ILIKE \'%wine%\' OR exterior ILIKE \'%vino%\')',
      'teal': '(exterior ILIKE \'%teal%\' OR exterior ILIKE \'%turquoise%\' OR exterior ILIKE \'%turquesa%\')',
      'cream': '(exterior ILIKE \'%cream%\' OR exterior ILIKE \'%crema%\' OR exterior ILIKE \'%beige%\')',
      'navy': '(exterior ILIKE \'%navy%\' OR exterior ILIKE \'%marine%\' OR exterior ILIKE \'%marino%\')',
      'charcoal': '(exterior ILIKE \'%charcoal%\' OR exterior ILIKE \'%carbon%\')'
    };
    
    // Check if we have variations for this color
    if (colorVariations[baseColor]) {
      conditions.push(colorVariations[baseColor]);
    } else {
      // Generic search for colors not in our map
      conditions.push(`exterior ILIKE '%${parameters.color}%'`);
    }
  }
  
  // Handle condition
  if (parameters.condition) {
    conditions.push(`condition ILIKE '%${parameters.condition}%'`);
  }
  
  // Handle location - always include Dominican Republic
  if (parameters.location) {
    conditions.push(`(location ILIKE '%${parameters.location}%' OR address ILIKE '%${parameters.location}%')`);
  } else {
    conditions.push(`(location ILIKE '%Dominican Republic%' OR location ILIKE '%República Dominicana%')`);
  }
  
  // Build final query
  let sqlQuery = "SELECT * FROM vehicles";
  
  if (conditions.length > 0) {
    sqlQuery += " WHERE " + conditions.join(" AND ");
  } else {
    // Fallback to just limit by location if no other conditions
    sqlQuery += " WHERE (location ILIKE '%Dominican Republic%' OR location ILIKE '%República Dominicana%')";
  }
  
  // Always add a limit
  sqlQuery += " LIMIT 15";
  
  console.log('Built optimized SQL query:', sqlQuery);
  return sqlQuery;
}

/**
 * Process a natural language query about vehicles with optimizations
 * @param {string} userQuery - The natural language query from the user
 * @returns {Object} - The processed response with text and vehicle data
 */
async function processVehicleQuery(userQuery) {
  console.time('queryProcessingTime');
  const start = Date.now();
  
  try {
    // Normalize query for better cache hits (lowercase, trim extra spaces)
    const normalizedQuery = userQuery.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Check cache first - this is a fast operation
    if (queryCache.has(normalizedQuery)) {
      const cached = queryCache.get(normalizedQuery);
      if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
        console.log('Cache hit for query:', normalizedQuery);
        console.timeEnd('queryProcessingTime');
        return cached.result;
      } else {
        console.log('Cache expired for query:', normalizedQuery);
        queryCache.delete(normalizedQuery);
      }
    }
    
    // Detect language (fast operation)
    const language = detectLanguage(normalizedQuery);
    
    // Step 1: Extract structured parameters from the query
    console.time('paramExtractionTime');
    const extractedParams = await extractVehicleParameters(normalizedQuery, language);
    console.timeEnd('paramExtractionTime');
    
    // Step 2: Build optimized SQL from the parameters
    console.time('sqlBuildingTime');
    const optimizedSqlQuery = buildOptimizedSqlQuery(extractedParams);
    console.timeEnd('sqlBuildingTime');
    
    // Step 3: Execute the optimized SQL query
    console.time('databaseQueryTime');
    let vehicleResults = [];
    try {
      vehicleResults = await executeRawQuery(optimizedSqlQuery);
    } catch (dbError) {
      console.error('Database query error:', dbError);
      // Don't fail here, continue with empty results and try fallbacks
    }
    console.timeEnd('databaseQueryTime');
    
    // If no results found with optimized query, try simplified query
    if (vehicleResults.length === 0) {
      console.log('No results with optimized query, trying simplified SQL...');
      
      // Create a simpler query that just focuses on brand and model
      let simplifiedQuery = "SELECT * FROM vehicles WHERE ";
      const conditions = [];
      
      if (extractedParams.parameters.brand) {
        conditions.push(`brand ILIKE '%${extractedParams.parameters.brand}%'`);
      }
      
      if (extractedParams.parameters.model) {
        conditions.push(`model ILIKE '%${extractedParams.parameters.model}%'`);
      }
      
      // If no brand or model, try to extract terms from the original query
      if (conditions.length === 0) {
        const terms = normalizedQuery.split(/\s+/).filter(term => term.length > 3);
        if (terms.length > 0) {
          const termConditions = terms.map(term => 
            `(brand ILIKE '%${term}%' OR model ILIKE '%${term}%')`
          );
          conditions.push(`(${termConditions.join(' OR ')})`);
        }
      }
      
      // Add location filter
      conditions.push(`(location ILIKE '%Dominican Republic%' OR location ILIKE '%República Dominicana%')`);
      
      // Complete the query
      simplifiedQuery += conditions.join(' AND ');
      simplifiedQuery += " LIMIT 15";
      
      console.log('Executing simplified query:', simplifiedQuery);
      try {
        const simplifiedResults = await executeRawQuery(simplifiedQuery);
        console.log(`Simplified query found ${simplifiedResults.length} results`);
        
        if (simplifiedResults.length > 0) {
          vehicleResults = simplifiedResults;
        }
      } catch (fallbackError) {
        console.error('Error executing simplified query:', fallbackError);
      }
    }
    
    // If still no results, try a broader keyword search focusing on brand/model
    if (vehicleResults.length === 0 && (extractedParams.parameters.brand || extractedParams.parameters.model)) {
      console.log('Still no results, trying broader keyword search...');
      
      const brand = extractedParams.parameters.brand || '';
      const model = extractedParams.parameters.model || '';
      
      // Use broader matching
      const keywordQuery = `
        SELECT * FROM vehicles 
        WHERE (
          ${brand ? `brand ILIKE '%${brand}%' OR` : ''}
          ${model ? `model ILIKE '%${model}%' OR` : ''}
          FALSE
        )
        AND (location ILIKE '%Dominican Republic%' OR location ILIKE '%República Dominicana%')
        LIMIT 15
      `;
      
      console.log('Executing keyword query:', keywordQuery);
      try {
        const keywordResults = await executeRawQuery(keywordQuery);
        console.log(`Keyword query found ${keywordResults.length} results`);
        
        if (keywordResults.length > 0) {
          vehicleResults = keywordResults;
        }
      } catch (keywordError) {
        console.error('Error executing keyword query:', keywordError);
      }
    }
    
    // Use the first 10 results to generate the response
    const limitedResults = Array.isArray(vehicleResults) ? vehicleResults.slice(0, 10) : [];
    
    // Format the response
    console.time('responseFormattingTime');
    
    // Generate smart suggestions if no results found
    let smartSuggestions = null;
    if (vehicleResults.length === 0) {
      console.time('suggestionGenerationTime');
      try {
        smartSuggestions = await generateSmartSuggestions(extractedParams, language);
      } catch (suggestionError) {
        console.error('Error generating suggestions:', suggestionError);
        // Create basic suggestions
        smartSuggestions = {
          analysis: language === 'es' 
            ? "No encontramos vehículos que coincidan exactamente con su búsqueda." 
            : "We couldn't find vehicles that exactly match your search.",
          alternative_searches: [
            {
              description: language === 'es' 
                ? "Intente buscar solo por marca" 
                : "Try searching by brand only",
              modified_parameters: {}
            },
            {
              description: language === 'es' 
                ? "Amplíe el rango de precios" 
                : "Expand your price range",
              modified_parameters: {}
            }
          ],
          follow_up_questions: [
            language === 'es' 
              ? "¿Qué características son más importantes para usted?" 
              : "Which features are most important to you?",
            language === 'es' 
              ? "¿Consideraría otras marcas o modelos similares?" 
              : "Would you consider other similar brands or models?"
          ]
        };
      }
      console.timeEnd('suggestionGenerationTime');
    }
    
    // Create a response cache key
    const responseCacheKey = `resp:${language}:${vehicleResults.length}:${normalizedQuery}`;
    let responseText;
    
    // Check if we have a cached response for this query pattern
    if (RESPONSE_CACHE.has(responseCacheKey)) {
      console.log('Response formatting cache hit');
      responseText = RESPONSE_CACHE.get(responseCacheKey);
    } else {
      // Generate a response with either results or smart suggestions
      let responsePrompt;
      
      if (vehicleResults.length > 0) {
        responsePrompt = `
          You are a vehicle database assistant providing a ${language === 'es' ? 'Spanish' : 'English'} response to: "${normalizedQuery}"
          
          Found ${vehicleResults.length} vehicles in Dominican Republic.
          
          Here are the first few results:
          ${JSON.stringify(limitedResults.slice(0, 3), null, 2)}
          
          Give a short, natural-sounding response that:
          - Summarizes key information about the results
          - Mentions how many vehicles were found
          - Highlights key features of the vehicles (price range, years, etc.)
          - Is professional, concise and helpful
          - ONLY return the text response, nothing else
        `;
      } else {
        responsePrompt = `
          You are a professional vehicle database assistant providing a ${language === 'es' ? 'Spanish' : 'English'} response to: "${normalizedQuery}"
          
          Unfortunately, no vehicles were found in our Dominican Republic database that match this query.
          
          Our analysis suggests: "${smartSuggestions.analysis}"
          
          Alternative searches to suggest:
          ${smartSuggestions.alternative_searches.map(alt => `- ${alt.description}`).join('\n')}
          
          Follow-up questions:
          ${smartSuggestions.follow_up_questions.map(q => `- ${q}`).join('\n')}
          
          Give a professional, helpful response that:
          1. Acknowledges that no results were found in our Dominican Republic database
          2. Briefly explains why (using the analysis)
          3. Suggests 2-3 specific alternative searches they could try
          4. Asks 1-2 follow-up questions to better understand their needs
          5. Maintains a professional, courteous tone
          6. ONLY return the text response, nothing else
        `;
      }
  
      try {
        const formattedResponse = await Promise.race([
          openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: responsePrompt },
              { role: "user", content: "Format the vehicle query results" }
            ],
            temperature: 0.6,
            max_tokens: 250 // Limit response size for speed
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Response formatting timeout')), 4000)
          )
        ]);
    
        responseText = formattedResponse.choices[0].message.content;
      } catch (responseError) {
        console.error('Error generating response:', responseError);
        // Create a basic response as fallback
        if (vehicleResults.length > 0) {
          responseText = language === 'es'
            ? `Encontramos ${vehicleResults.length} vehículos en República Dominicana que coinciden con su búsqueda.`
            : `We found ${vehicleResults.length} vehicles in Dominican Republic that match your search.`;
        } else {
          responseText = language === 'es'
            ? "No encontramos vehículos que coincidan con su búsqueda. Intente ampliar los términos de búsqueda o considere otras marcas o modelos similares."
            : "We couldn't find vehicles matching your search. Try broadening your search terms or consider other similar brands or models.";
        }
      }
      
      // Cache the response
      RESPONSE_CACHE.set(responseCacheKey, responseText);
    }
    
    console.timeEnd('responseFormattingTime');
    
    // Structure the final response
    const result = {
      response: responseText,
      vehicles: limitedResults,
      total_results: vehicleResults.length,
      processing_time_ms: Date.now() - start,
      extracted_params: extractedParams
    };
    
    // Include suggestions if no results found
    if (vehicleResults.length === 0 && smartSuggestions) {
      result.suggestions = smartSuggestions;
    }
    
    // Cache the result
    queryCache.set(normalizedQuery, {
      result,
      timestamp: Date.now()
    });
    
    console.timeEnd('queryProcessingTime');
    return result;
  } catch (error) {
    console.error('Error processing query:', error);
    console.timeEnd('queryProcessingTime');
    
    // Extract any useful information from the query
    let simpleResponse = "";
    try {
      const normalizedQuery = userQuery.toLowerCase().trim();
      const words = normalizedQuery.split(/\s+/);
      
      // Look for common car brands
      const brands = ['toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'bmw'];
      let foundBrand = null;
      for (const word of words) {
        if (brands.includes(word)) {
          foundBrand = word;
          break;
        }
      }
      
      if (foundBrand) {
        simpleResponse = `We'd be happy to help you find a ${foundBrand.charAt(0).toUpperCase() + foundBrand.slice(1)} vehicle in Dominican Republic. Could you provide more details about what specific model or features you're looking for?`;
      } else {
        simpleResponse = "We'd be happy to help you find a vehicle in Dominican Republic. Could you please provide more details about what you're looking for?";
      }
    } catch (fallbackError) {
      console.error('Error creating fallback response:', fallbackError);
      simpleResponse = "We'd be happy to help you find a vehicle in Dominican Republic. Could you please provide more details about what you're looking for?";
    }
    
    return {
      response: simpleResponse,
      vehicles: [],
      total_results: 0,
      processing_time_ms: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * Extract key search terms from a natural language query with cross-language support
 * @param {string} query - The user query
 * @param {string} language - The query language ('es' or 'en')
 * @returns {Promise<Object>} - Object with terms in both languages
 */
async function extractKeySearchTerms(query, language) {
  try {
    const prompt = `
    You are a bilingual (English and Spanish) vehicle search specialist. Extract key terms from this query and provide translations:
    
    Query: "${query}"
    Detected language: ${language === 'es' ? 'Spanish' : 'English'}
    
    Rules:
    1. Extract potential car brands (BMW, Toyota, etc.), models (Corolla, X5, etc.), and descriptive terms (SUV, sedan, etc.)
    2. Correct common misspellings (e.g. "Gwagon" → "G Wagon", "Mercedez" → "Mercedes")
    3. Recognize alternate names (e.g. "Benz" → "Mercedes")
    4. For EACH term, provide both English and Spanish versions
    5. Return ONLY a JSON object with the following structure:
    {
      "original_terms": ["term1", "term2"],
      "english_terms": ["english1", "english2"],
      "spanish_terms": ["spanish1", "spanish2"]
    }
    6. Include at most 3 key terms
    
    Example:
    Query: "Looking for a gwagon in Santo Domingo"
    {
      "original_terms": ["G Wagon", "Mercedes"],
      "english_terms": ["G Wagon", "Mercedes", "G Class"],
      "spanish_terms": ["Clase G", "Mercedes", "G Wagon"]
    }
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Extract the key vehicle search terms with translations" }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 250
    });
    
    let result = {
      original_terms: [],
      english_terms: [],
      spanish_terms: []
    };
    
    try {
      const content = JSON.parse(response.choices[0].message.content);
      result = {
        original_terms: content.original_terms || [],
        english_terms: content.english_terms || [],
        spanish_terms: content.spanish_terms || []
      };
    } catch (parseError) {
      console.error('Error parsing key terms JSON:', parseError);
      // Fallback to simple extraction
      const words = query.split(/\s+/);
      const terms = words.filter(word => 
        word.length > 3 && 
        !['want', 'find', 'need', 'looking', 'search', 'where', 'when', 'what', 'quiero', 'busco', 'necesito', 'donde', 'cuando', 'que'].includes(word.toLowerCase())
      ).slice(0, 2);
      
      result.original_terms = terms;
      result.english_terms = terms;
      result.spanish_terms = terms;
    }
    
    console.log('Extracted search terms:', result);
    return result;
  } catch (error) {
    console.error('Error extracting key search terms:', error);
    // Basic fallback
    const words = query.split(/\s+/);
    const terms = words.filter(word => 
      word.length > 3 && 
      !['want', 'find', 'need', 'looking', 'search', 'where', 'when', 'what', 'quiero', 'busco', 'necesito', 'donde', 'cuando', 'que'].includes(word.toLowerCase())
    ).slice(0, 2);
    
    return {
      original_terms: terms,
      english_terms: terms,
      spanish_terms: terms
    };
  }
}

/**
 * Generate intelligent suggestions when no vehicles are found
 * @param {Object} extractedParams - The parameters extracted from the query
 * @param {string} language - The detected language
 * @returns {Promise<Object>} - Alternative suggestions and follow-up questions
 */
async function generateSmartSuggestions(extractedParams, language) {
  try {
    // Get parameters
    const params = extractedParams.parameters || {};
    
    // Build suggestion prompt
    const prompt = `
    You are a vehicle database expert helping a user who found NO RESULTS for their search.
    
    The user was looking for: ${JSON.stringify(params, null, 2)}
    
    Your task:
    1. Analyze what might have caused zero results (too specific? rare combination?)
    2. Generate 3 SPECIFIC alternative searches that are more likely to yield results
    3. Create 2 follow-up questions to better understand what the user wants
    
    IMPORTANT:
    - Suggest relaxing the most restrictive parameters first
    - For technical specs (like cylinders), suggest alternatives (e.g., "Try V6 instead of V8")
    - If price range seems unrealistic, suggest a more realistic range
    - For rare models/brands, suggest similar popular alternatives
    - Follow-up questions should be conversational and focused on clarifying intent
    
    Return JSON with this structure:
    {
      "analysis": "Brief analysis of why the search might have failed",
      "alternative_searches": [
        {
          "description": "Description of alternative search 1",
          "modified_parameters": {"key parameters that changed": "new values"}
        },
        {similar structure for other alternatives}
      ],
      "follow_up_questions": [
        "Question 1?",
        "Question 2?"
      ]
    }`;
    
    // Generate suggestions using AI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Generate smart suggestions for this failed vehicle search" }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const suggestions = JSON.parse(response.choices[0].message.content);
    console.log('Generated smart suggestions:', suggestions);
    
    // Translate suggestions if needed
    if (language === 'es' && suggestions) {
      // Translate analysis and questions to Spanish
      const translationPrompt = `
      Translate the following vehicle search suggestions to Spanish while preserving technical terms:
      
      Analysis: "${suggestions.analysis}"
      
      Follow-up Questions:
      ${suggestions.follow_up_questions.join('\n')}
      
      Return JSON with:
      {
        "translated_analysis": "analysis in Spanish",
        "translated_questions": ["question 1 in Spanish", "question 2 in Spanish"]
      }`;
      
      const translationResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: translationPrompt },
          { role: "user", content: "Translate to Spanish" }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });
      
      const translations = JSON.parse(translationResponse.choices[0].message.content);
      
      // Update with translations
      suggestions.analysis = translations.translated_analysis;
      suggestions.follow_up_questions = translations.translated_questions;
      
      // Translate alternative search descriptions
      if (suggestions.alternative_searches) {
        for (let i = 0; i < suggestions.alternative_searches.length; i++) {
          const altSearch = suggestions.alternative_searches[i];
          const translationAltPrompt = `Translate to Spanish: "${altSearch.description}"`;
          
          const altTranslationResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "You are a Spanish translator specializing in vehicles." },
              { role: "user", content: translationAltPrompt }
            ],
            temperature: 0.3
          });
          
          altSearch.description = altTranslationResponse.choices[0].message.content.replace(/^"/, '').replace(/"$/, '');
        }
      }
    }
    
    return suggestions;
  } catch (error) {
    console.error('Error generating smart suggestions:', error);
    // Return simple fallback suggestions
    return {
      analysis: language === 'es' 
        ? "La búsqueda puede ser demasiado específica." 
        : "The search may be too specific.",
      alternative_searches: [
        {
          description: language === 'es' ? "Intente ampliar su búsqueda" : "Try broadening your search",
          modified_parameters: {}
        }
      ],
      follow_up_questions: [
        language === 'es' ? "¿Qué características son más importantes para usted?" : "Which features are most important to you?",
        language === 'es' ? "¿Consideraría otras marcas o modelos?" : "Would you consider other brands or models?"
      ]
    };
  }
}

// Add method to clear caches if needed
function clearCaches() {
  queryCache.clear();
  RESPONSE_CACHE.clear();
  console.log('All caches cleared');
}

module.exports = { 
  processVehicleQuery,
  clearCaches,
  extractVehicleParameters,
  generateSmartSuggestions,
  createFallbackParameters,
  detectVehicleColor
}; 