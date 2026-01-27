const express = require('express');
const router = express.Router();
const { processVehicleQuery, clearCaches } = require('../langchain/agent');
const { clearQueryCache } = require('../db');
const { performWebSearch, detectLanguage, needsWebSearch } = require('../utils/promptEnhancer');
const { OpenAI } = require('openai');

// Set request timeout
const QUERY_TIMEOUT = 15000; // 15 seconds

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /query - Process any natural language query with intelligent routing
 * 
 * Request body:
 * {
 *   "query": "string" - The natural language query in English or Spanish
 * }
 * 
 * Response varies based on query type:
 * For car database queries:
 * {
 *   "response": "string" - Natural language response
 *   "vehicles": Array - Array of vehicle objects
 *   "total_results": Integer - Total matching vehicles
 *   "processing_time_ms": Integer - Processing time
 * }
 * 
 * For web search queries:
 * {
 *   "response": "string" - Natural language response
 *   "search_results": Array - Array of search result objects with title, url, etc.
 *   "search_performed": Boolean - Whether search was performed
 *   "processing_time_ms": Integer - Processing time
 * }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  let timeout;
  
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request. Please provide a "query" string.'
      });
    }
    
    // Set a timeout to handle long-running queries
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error('Query processing timeout'));
      }, QUERY_TIMEOUT);
    });
    
    // Detect language for proper response generation
    const language = detectLanguage(query);
    const languageKey = language === 'spanish' ? 'spanish' : 'english';
    
    // First check if the query is related to vehicles/cars
    const isCarRelated = await checkIfCarRelated(query);
    
    // Process based on query type
    let finalResponse;
    
    if (isCarRelated) {
      // Car-related query - use the database search
      console.log('Processing as car-related query:', query);
      try {
        const dbQueryPromise = processVehicleQuery(query);
        const dbResult = await Promise.race([dbQueryPromise, timeoutPromise]);
        
        finalResponse = {
          response: dbResult.response,
          vehicles: dbResult.vehicles || [],
          total_results: dbResult.total_results || 0,
          processing_time_ms: Date.now() - startTime
        };
      } catch (dbError) {
        console.error('Database query failed:', dbError);
        // Fallback to web search if database query fails
        finalResponse = await handleWebSearch(query, languageKey, startTime);
      }
    } else {
      // Not car-related - use web search
      console.log('Processing as general query with web search:', query);
      finalResponse = await handleWebSearch(query, languageKey, startTime);
    }
    
    // Clear the timeout since we got a result
    clearTimeout(timeout);
    
    return res.json(finalResponse);
  } catch (error) {
    // Clear the timeout if set
    if (timeout) clearTimeout(timeout);
    
    console.error('Error processing query:', error);
    
    // Get language to localize error message
    const language = detectLanguage(req.body.query || '');
    const errorMessage = language === 'spanish'
      ? 'Lo siento, ocurrió un error al procesar tu consulta. Por favor, intenta de nuevo.'
      : 'Sorry, an error occurred while processing your query. Please try again.';
    
    return res.status(500).json({
      response: errorMessage,
      error: 'An error occurred while processing your request.',
      message: error.message,
      processing_time_ms: Date.now() - startTime
    });
  }
});

/**
 * Handle web search and generate response
 */
async function handleWebSearch(query, languageKey, startTime) {
  // Perform the web search
  const searchData = await performWebSearch(query, languageKey);
  
  // Generate a response based on the search results
  const response = await generateResponseFromSearch(query, searchData, languageKey);
  
  return {
    response: response,
    search_results: searchData.options || [],
    search_performed: true,
    processing_time_ms: Date.now() - startTime
  };
}

/**
 * Generate a natural language response from search results
 */
async function generateResponseFromSearch(query, searchData, languageKey) {
  // Create system prompt
  const systemPrompt = getSystemPrompt(languageKey);
  
  // Format options nicely for the AI
  const formattedOptions = searchData.options.map((option, index) => 
    `[${index+1}] ${option.title}${option.location ? ` (${option.location})` : ''}: ${option.description}`
  ).join('\n');
  
  // Create prompt with search data
  const searchContext = `
Web search results for: "${query}"
${searchData.summary}

Results:
${formattedOptions}

Based on these search results, provide a helpful response in ${languageKey === 'spanish' ? 'Spanish' : 'English'}.
Include relevant information from the search results, and if appropriate, mention specific locations or options.
Do not make up information or add URLs that are not in the search results.
`;

  try {
    // Call OpenAI for a conversational response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: searchContext }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating response from search:', error);
    // Fallback response if OpenAI fails
    return languageKey === 'spanish'
      ? `Basado en la búsqueda, encontré ${searchData.options.length} resultados relacionados con tu consulta.`
      : `Based on search, I found ${searchData.options.length} results related to your query.`;
  }
}

/**
 * Check if the query is related to cars/vehicles
 */
async function checkIfCarRelated(query) {
  // First do a simple keyword check for common car-related terms
  const carKeywords = [
    // English car terms
    'car', 'cars', 'vehicle', 'vehicles', 'auto', 'automobile', 'truck', 'suv', 
    'sedan', 'hatchback', 'minivan', 'van', 'coupe', 'convertible', 'toyota', 
    'honda', 'ford', 'bmw', 'audi', 'mercedes', 'hyundai', 'kia', 'mazda', 
    'chevrolet', 'jeep', 'cylinder', 'cylinders', 'engine', 'transmission', 'mpg', 'mileage',
    'gas', 'fuel', 'diesel', 'electric', 'hybrid', 'horsepower', 'hp', 'dealer',
    'v6', 'v8', 'v12', 'v4', '4-cylinder', '6-cylinder', '8-cylinder', 'displacement',
    'turbo', 'turbocharged', 'motor', 'drive', 'awd', 'fwd', 'rwd', '4x4',
    'automatic', 'manual', 'gearbox',
    
    // Spanish car terms
    'carro', 'carros', 'vehículo', 'vehículos', 'auto', 'automóvil', 'camión',
    'camioneta', 'sedán', 'cilindro', 'cilindros', 'motor', 'transmisión', 
    'gasolina', 'combustible', 'diésel', 'eléctrico', 'híbrido', 'caballos',
    'concesionario', 'dealer', 'potencia', 'turbo', 'turboalimentado',
    'automática', 'manual', 'caja de cambios', 'tracción', '4x4'
  ];
  
  const queryLower = query.toLowerCase();
  
  // Check if any car keyword is in the query
  const hasCarKeyword = carKeywords.some(keyword => {
    // Check for word boundaries to avoid partial matches
    // Add spaces around query and keyword for more accurate matching
    return ` ${queryLower} `.includes(` ${keyword} `) || 
           queryLower.startsWith(`${keyword} `) || 
           queryLower.endsWith(` ${keyword}`) ||
           queryLower === keyword;
  });
  
  // If we found a clear car-related keyword, return true immediately
  if (hasCarKeyword) {
    console.log('Detected car-related keyword in query');
    return true;
  }
  
  // For more complex queries or ones without obvious keywords, use AI
  try {
    // Use a more precise prompt to determine if car-related
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You determine if a query is related to cars, vehicles, automotive topics, or vehicle shopping.
Respond with "true" ONLY if the query is clearly about:
- specific car brands, models, or types
- car pricing, features, or comparisons
- vehicle shopping or dealerships
- car specifications, performance, or technical details
- engine types, cylinders, transmissions
- fuel efficiency, mileage, gas consumption
- car parts, components, or accessories

For all other queries (like general information, tourism, medicine, food, etc.), respond with "false".

Examples:
"Show me Toyota Corollas in Santo Domingo" -> true
"What is the price of a used Honda Civic?" -> true
"Tell me about BMW dealerships" -> true
"I need a family SUV with good fuel economy" -> true
"Looking for 4 cylinder cars" -> true
"Cars with 6 cylinder engines" -> true
"Best mileage cars in Dominican Republic" -> true

"Where can I find medicine in Santo Domingo?" -> false
"What are good restaurants near me?" -> false
"Tell me about the weather today" -> false
"Where can I buy throat medicine?" -> false`
        },
        {
          role: "user",
          content: `Is this query related to cars or vehicles? Query: "${query}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });
    
    const result = completion.choices[0].message.content.trim().toLowerCase();
    console.log(`AI car detection for query "${query}": ${result}`);
    return result === 'true';
  } catch (error) {
    console.error('Error determining if car-related:', error);
    // If there's an error checking with AI, use our keyword detection result
    return hasCarKeyword;
  }
}

/**
 * Get the appropriate system prompt based on language
 */
function getSystemPrompt(language) {
  const SYSTEM_PROMPTS = {
    spanish: `Eres un asistente de inteligencia artificial 100% dominicano, diseñado para atender exclusivamente al público de República Dominicana.
Conoces en detalle la cultura, los barrios, las plazas comerciales, el Monumento de Santiago, las zonas de playa, las costumbres y el lenguaje dominicano.
Respondes adaptándote al estilo del usuario: si el usuario habla formal, tú mantienes un tono educado y profesional; si el usuario habla en lenguaje coloquial dominicano, puedes responderle en el mismo tono pero de manera respetuosa y amigable.
Siempre priorizas claridad, practicidad y cercanía en tus respuestas.
Te especializas en temas locales como vehículos, inmuebles, precios en pesos dominicanos (DOP), y vida cotidiana en ciudades dominicanas.
No mencionas que eres una IA, sino que te expresas como un experto dominicano. Tu nombre es NODO.ai.`,

    english: `You are a 100% Dominican AI assistant, designed exclusively for the Dominican Republic audience.
You know in detail the culture, neighborhoods, shopping centers, the Monument of Santiago, beach areas, customs, and Dominican language.
You respond by adapting to the user's style: formal or colloquial, always respectful and friendly.
You prioritize clarity, practicality, and closeness in your responses.
You specialize in local topics like vehicles, real estate, prices in Dominican pesos (DOP), and daily life in Dominican cities.
You don't mention you're an AI, instead expressing yourself as a Dominican expert. Your name is NODO.ai.`
  };
  
  return SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.english;
}

/**
 * POST /query/clear-cache - Clear all caches to refresh data
 * Note: This should be protected in production
 */
router.post('/clear-cache', (req, res) => {
  try {
    // Clear LangChain caches
    clearCaches();
    
    // Clear database query cache
    clearQueryCache();
    
    return res.json({
      success: true,
      message: 'All caches cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing caches:', error);
    return res.status(500).json({
      error: 'Failed to clear caches',
      message: error.message
    });
  }
});

module.exports = {
  router,
  checkIfCarRelated  // Export the checkIfCarRelated function
}; 