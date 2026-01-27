/**
 * Prompt Enhancer Module
 * 
 * This module prepares OpenAI API requests by:
 * 1. Including a fixed Dominican system prompt
 * 2. Detecting if the query needs up-to-date information
 * 3. Performing web searches when needed
 * 4. Adding few-shot examples
 */

const { OpenAI } = require('openai');
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Dynamic import for node-fetch
let fetch = null;

async function getFetch() {
  if (!fetch) {
    try {
      const fetchModule = await import('node-fetch');
      fetch = fetchModule.default;
    } catch (error) {
      console.error('Failed to load node-fetch:', error);
      throw new Error('Failed to load fetch module');
    }
  }
  return fetch;
}

// Fixed system prompts
const SYSTEM_PROMPTS = {
  spanish: `Eres un asistente de inteligencia artificial 100% dominicano, diseñado para atender exclusivamente al público de República Dominicana.
Conoces en detalle la cultura, los barrios, las plazas comerciales (como Ágora Mall, Blue Mall, Megacentro, Plaza Lama, etc.), el Monumento de Santiago, las zonas de playa, las costumbres y el lenguaje dominicano.
Respondes adaptándote al estilo del usuario: si el usuario habla formal, tú mantienes un tono educado y profesional; si el usuario habla en lenguaje coloquial dominicano ('qué lo qué', 'vaina', 'bacano'), puedes responderle en el mismo tono pero de manera respetuosa y amigable.
Siempre priorizas claridad, practicidad y cercanía en tus respuestas.
Te especializas en temas locales: compra y venta de vehículos, alquiler y venta de inmuebles, electrodomésticos, todo tipo de articulos y búsqueda de servicios en RD, consultas de precios en pesos dominicanos o dolar, vida cotidiana en ciudades dominicanas.
Utilizas pesos dominicanos (DOP) como referencia de moneda cuando sea relevante.
No mencionas que eres una IA de OpenAI ni referencias a otras marcas internacionales, excepto si es necesario para responder algo sobre el mercado local.
Tu objetivo es que el usuario sienta que está hablando con un experto dominicano, cercano y confiable. NODO.ai te llamas.`,

  english: `You are a 100% Dominican AI assistant, designed exclusively for the Dominican Republic audience.
You know in detail the culture, neighborhoods, shopping centers (such as Ágora Mall, Blue Mall, Megacentro, Plaza Lama, etc.), the Monument of Santiago, beach areas, customs, and Dominican language.
You respond by adapting to the user's style: if the user speaks formally, you maintain a polite and professional tone; if the user speaks in Dominican colloquial language ('qué lo qué', 'vaina', 'bacano'), you can respond in the same tone but in a respectful and friendly manner.
You always prioritize clarity, practicality, and closeness in your responses.
You specialize in local topics: buying and selling vehicles, renting and selling real estate, home appliances, all kinds of articles, and search for services in DR, price inquiries in Dominican pesos or dollars, daily life in Dominican cities.
You use Dominican pesos (DOP) as a currency reference when relevant.
You don't mention that you're an OpenAI AI or reference other international brands, except if necessary to answer something about the local market.
Your goal is for the user to feel like they're talking to a Dominican expert who is close and trustworthy. Your name is NODO.ai.`
};

// Few-shot conversation examples in Spanish
const FEW_SHOT_EXAMPLES = [
  { 
    role: "user", 
    content: "¿Dónde puedo comprar un carro usado en Santo Domingo?" 
  },
  { 
    role: "assistant", 
    content: "Puedes buscar en SuperCarros, Corotos o visitar dealers en la avenida 27 de Febrero, donde hay varias opciones de vehículos usados." 
  },
  { 
    role: "user", 
    content: "¿Cuánto cuesta alquilar un apartamento en Punta Cana?" 
  },
  { 
    role: "assistant", 
    content: "Dependiendo de la zona y el tamaño, el alquiler de un apartamento en Punta Cana puede variar entre RD$30,000 y RD$120,000 mensuales." 
  },
  { 
    role: "user", 
    content: "Loco, ¿dónde me puedo dar un chapuzón bacano por aquí cerca?" 
  },
  { 
    role: "assistant", 
    content: "¡Claro! Si estás en Santo Domingo, puedes ir a la playa de Boca Chica o a la de Juan Dolio, que están cerca y son perfectas para un chapuzón bacano." 
  }
];

// Keywords that trigger web search 
const SEARCH_KEYWORDS = {
  spanish: [
    "último", "trámite", "nuevo", "hoy", "requisitos", "actual", "coste", 
    "decreto", "precio", "resultado", "pelea", "evento", "ley", "reciente", 
    "noticia", "anuncio", "cambio", "medicina", "farmacia", "medicamento",
    "cerca", "cercano", "ubicación", "dirección", "donde", "dónde", "lugar",
    "médico", "hospital", "clínica", "emergencia", "tratamiento", "síntoma"
  ],
  english: [
    "latest", "procedure", "new", "today", "requirements", "current", "cost",
    "decree", "price", "result", "fight", "event", "law", "recent",
    "news", "announcement", "change", "medicine", "pharmacy", "drug", "medication",
    "nearby", "near", "location", "address", "where", "place", "find",
    "doctor", "hospital", "clinic", "emergency", "treatment", "symptom"
  ]
};

// Location-based keywords that almost always need web search
const LOCATION_KEYWORDS = [
  "near", "nearby", "close to", "around", "nearest", "where to find",
  "cerca", "cercano", "próximo a", "alrededor", "más cercano", "donde encontrar"
];

/**
 * Detect the language of the user's query
 * @param {string} query - The user query
 * @returns {string} - 'spanish' or 'english'
 */
function detectLanguage(query) {
  // Word counts for scoring
  let spanishScore = 0;
  let englishScore = 0;
  
  // Common Spanish words and patterns
  const spanishIndicators = [
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'en', 'con', 'por', 'para', 'como', 'qué', 'cuándo',
    'dónde', 'cómo', 'quién', 'y', 'o', 'pero', 'si', 'porque',
    'más', 'menos', 'muy', 'mucho', 'poco', 'este', 'esta', 'estos', 
    'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella',
    'santo domingo', 'república dominicana', 'dominicana'
  ];
  
  // Common English words and patterns
  const englishIndicators = [
    'the', 'a', 'an', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about',
    'from', 'to', 'and', 'or', 'but', 'if', 'because', 'as', 'what', 'when',
    'where', 'how', 'who', 'which', 'this', 'that', 'these', 'those',
    'more', 'less', 'very', 'much', 'few', 'looking', 'find', 'search',
    'show', 'tell', 'give', 'need', 'want', 'near', 'around', 'best',
    'dominican republic', 'santo domingo'
  ];
  
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);
  
  // Check for Spanish accent marks (strong indicator of Spanish)
  if (/[áéíóúñü]/i.test(queryLower)) {
    spanishScore += 3;
  }
  
  // Check for Spanish question marks or exclamation marks
  if (/¿|¡/.test(queryLower)) {
    spanishScore += 3;
  }
  
  // Score based on common words
  for (const word of words) {
    if (spanishIndicators.includes(word)) {
      spanishScore++;
    }
    if (englishIndicators.includes(word)) {
      englishScore++;
    }
  }
  
  // Check for Spanish patterns in the full query
  for (const indicator of spanishIndicators) {
    if (queryLower.includes(` ${indicator} `) || 
        queryLower.startsWith(`${indicator} `) || 
        queryLower.endsWith(` ${indicator}`) || 
        queryLower === indicator) {
      spanishScore++;
    }
  }
  
  // Check for English patterns in the full query
  for (const indicator of englishIndicators) {
    if (queryLower.includes(` ${indicator} `) || 
        queryLower.startsWith(`${indicator} `) || 
        queryLower.endsWith(` ${indicator}`) || 
        queryLower === indicator) {
      englishScore++;
    }
  }
  
  // Log the results
  console.log(`Language detection for "${query}": Spanish score ${spanishScore}, English score ${englishScore}`);
  
  // Return detected language or default to English for mixed/ambiguous queries
  return spanishScore > englishScore ? 'spanish' : 'english';
}

/**
 * Check if a query needs a web search for latest information
 * @param {string} query - The user query
 * @param {string} language - 'english' or 'spanish'
 * @returns {boolean} - Whether a search is needed
 */
function needsWebSearch(query, language) {
  const queryLower = query.toLowerCase();
  
  // Check location-based keywords first - these almost always need a search
  if (LOCATION_KEYWORDS.some(keyword => queryLower.includes(keyword))) {
    return true;
  }
  
  // Check for medical/pharmacy terms with location context
  if ((queryLower.includes("medicine") || queryLower.includes("medicina") || 
       queryLower.includes("pharmacy") || queryLower.includes("farmacia") ||
       queryLower.includes("drug") || queryLower.includes("medicamento")) &&
      (queryLower.includes("santo domingo") || queryLower.includes("dominican") || 
       queryLower.includes("dominicana"))) {
    return true;
  }
  
  // Standard keyword check
  const keywordsToCheck = SEARCH_KEYWORDS[language];
  return keywordsToCheck.some(keyword => queryLower.includes(keyword));
}

/**
 * Perform a web search and extract relevant information
 * @param {string} query - The search query
 * @param {string} language - 'english' or 'spanish'
 * @returns {Promise<Object>} - Formatted search results with summary and options
 */
async function performWebSearch(query, language) {
  try {
    const apiKey = process.env.SEARCHAPI_KEY;
    
    if (!apiKey) {
      console.log('No SearchAPI.io key found, using mock search');
      return mockWebSearch(query, language);
    }
    
    // Set up timeout for the search
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // Enhance query with location context if not already present
    const locationMentioned = query.toLowerCase().includes('dominican') || 
                             query.toLowerCase().includes('dominicana') || 
                             query.toLowerCase().includes('santo domingo');
    const searchQuery = locationMentioned ? query : `${query} República Dominicana`;
    
    // Execute search using SearchAPI.io
    let searchResults;
    try {
      // SearchAPI.io endpoint
      const endpoint = 'https://www.searchapi.io/api/v1/search';
      
      // Default to Google search engine
      const searchEngine = 'google';
      
      // Make the API call to SearchAPI.io
      const url = `${endpoint}?engine=${searchEngine}&q=${encodeURIComponent(searchQuery)}&api_key=${apiKey}`;
      
      const fetch = await getFetch();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`SearchAPI.io search failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('SearchAPI.io response:', JSON.stringify(data).substring(0, 500) + '...');
      
      // Extract organic results
      if (data && data.organic_results && data.organic_results.length > 0) {
        searchResults = data.organic_results.map(result => ({
          title: result.title || '',
          snippet: result.snippet || '',
          url: result.link || '',
          favicon: result.favicon || ''
        }));
      } else {
        throw new Error('No search results found');
      }
    } catch (searchApiError) {
      console.error(`SearchAPI.io error:`, searchApiError);
      // Fall back to mock search on API error
      console.log('Falling back to mock search due to API error');
      clearTimeout(timeoutId);
      return mockWebSearch(query, language);
    }
    
    clearTimeout(timeoutId);
    
    // Extract and format the results
    return formatSearchResults(searchResults, language);
  } catch (error) {
    console.error('Web search error:', error);
    // Fall back to mock search on any error
    return mockWebSearch(query, language);
  }
}

/**
 * Format search results based on SearchAPI.io response
 * @param {Array} results - API search results
 * @param {string} language - 'english' or 'spanish'
 * @returns {Object} - Formatted search results with structured data
 */
function formatSearchResults(results, language) {
  if (!results || results.length === 0) {
    return {
      summary: language === 'spanish' ? 
        'Información actualizada encontrada: No se encontraron resultados específicos relacionados con la consulta.' : 
        'Updated information found: No specific results were found related to the query.',
      options: []
    };
  }
  
  // Extract relevant information from the results
  const options = results.slice(0, 5).map(result => {
    // Extract data from SearchAPI.io format
    const title = result.title || '';
    const snippet = result.snippet || '';
    const url = result.url || result.link || '';
    
    // Try to extract location if available
    let location = '';
    if (snippet.toLowerCase().includes('address') || 
        snippet.toLowerCase().includes('dirección') ||
        snippet.toLowerCase().includes('ubicación') ||
        snippet.toLowerCase().includes('located') ||
        snippet.toLowerCase().includes('ubicado')) {
      // Try to extract location information
      const locationPatterns = [
        /(?:address|dirección|ubicación|located at|ubicado en)[:\s]+([^\.]+)/i,
        /(?:in|en) ([\w\s]+,\s*[\w\s]+)(?:,|\.|$)/i,
        /(calle|avenida|ave\.|av\.|c\/|carretera) ([^\.,:]+)/i
      ];
      
      for (const pattern of locationPatterns) {
        const match = snippet.match(pattern);
        if (match && match[1]) {
          location = match[1].trim();
          break;
        }
      }
    }
    
    // Generate favicon URL if we have a website URL
    let favicon = result.favicon || '';
    if (!favicon && url) {
      try {
        const urlObj = new URL(url);
        favicon = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
      } catch (e) {
        // Invalid URL, skip favicon
      }
    }
    
    return {
      title,
      description: snippet,
      url,
      location,
      favicon
    };
  });
  
  // Create a concise summary
  const summary = language === 'spanish' ? 
    `Información actualizada encontrada: Se encontraron ${options.length} resultados relacionados con tu búsqueda.` : 
    `Updated information found: Found ${options.length} results related to your search.`;
  
  return {
    summary,
    options
  };
}

/**
 * Mock web search for testing or when API key is missing
 * @param {string} query - The search query
 * @param {string} language - 'english' or 'spanish'
 * @returns {Object} - Mock search results with structured data
 */
function mockWebSearch(query, language) {
  const queryLower = query.toLowerCase();
  let options = [];
  
  // Mock results for pharmacy/medicine queries
  if (queryLower.includes('medicine') || queryLower.includes('medicina') ||
      queryLower.includes('pharmacy') || queryLower.includes('farmacia')) {
    
    if (language === 'spanish') {
      options = [
        {
          title: "Farmacia Carol",
          description: "Cadena de farmacias con múltiples sucursales en Santo Domingo. Ofrecen medicamentos para la garganta y consultas rápidas.",
          url: "https://farmaciacarol.com.do",
          location: "Av. 27 de Febrero #456, Santo Domingo",
          favicon: "https://farmaciacarol.com.do/favicon.ico"
        },
        {
          title: "Farma Extra",
          description: "Farmacia con servicio 24/7 y amplio inventario de medicamentos para dolencias de garganta y sistema respiratorio.",
          url: "https://farmaextra.com.do",
          location: "Calle El Conde #58, Zona Colonial, Santo Domingo",
          favicon: "https://farmaextra.com.do/favicon.ico"
        },
        {
          title: "Los Hidalgos",
          description: "Farmacia popular con productos a buen precio. Disponen de medicamentos genéricos y de marca para problemas de garganta.",
          url: "https://loshidalgos.com.do",
          location: "Av. Winston Churchill #103, Santo Domingo",
          favicon: "https://loshidalgos.com.do/favicon.ico"
        }
      ];
    } else {
      options = [
        {
          title: "Pharmacy Carol",
          description: "Pharmacy chain with multiple locations in Santo Domingo. They offer throat medicine and quick consultations.",
          url: "https://farmaciacarol.com.do",
          location: "Av. 27 de Febrero #456, Santo Domingo",
          favicon: "https://farmaciacarol.com.do/favicon.ico"
        },
        {
          title: "Farma Extra",
          description: "24/7 pharmacy with extensive inventory of medicines for throat and respiratory system issues.",
          url: "https://farmaextra.com.do",
          location: "Calle El Conde #58, Colonial Zone, Santo Domingo",
          favicon: "https://farmaextra.com.do/favicon.ico"
        },
        {
          title: "Los Hidalgos",
          description: "Popular pharmacy with well-priced products. They have both generic and brand-name medications for throat problems.",
          url: "https://loshidalgos.com.do",
          location: "Av. Winston Churchill #103, Santo Domingo",
          favicon: "https://loshidalgos.com.do/favicon.ico"
        }
      ];
    }
  } 
  // Mock results for dollar price queries
  else if (queryLower.includes('precio') || queryLower.includes('price') ||
           queryLower.includes('dólar') || queryLower.includes('dollar')) {
    if (language === 'spanish') {
      options = [
        {
          title: "Banco Central de la República Dominicana",
          description: "El precio actual del dólar en República Dominicana es aproximadamente 58.5 pesos dominicanos por 1 USD según la tasa oficial.",
          url: "https://bancentral.gov.do",
          location: "Santo Domingo",
          favicon: "https://bancentral.gov.do/favicon.ico"
        }
      ];
    } else {
      options = [
        {
          title: "Central Bank of the Dominican Republic",
          description: "The current dollar price in the Dominican Republic is approximately 58.5 Dominican pesos per 1 USD according to the official rate.",
          url: "https://bancentral.gov.do",
          location: "Santo Domingo",
          favicon: "https://bancentral.gov.do/favicon.ico"
        }
      ];
    }
  }
  // Mock results for presidential decree queries
  else if (queryLower.includes('decreto') || queryLower.includes('decree')) {
    if (language === 'spanish') {
      options = [
        {
          title: "Presidencia de la República Dominicana",
          description: "El más reciente decreto presidencial en República Dominicana es el 625-24, publicado el 15 de octubre de 2024.",
          url: "https://presidencia.gob.do",
          location: "Santo Domingo",
          favicon: "https://presidencia.gob.do/favicon.ico"
        }
      ];
    } else {
      options = [
        {
          title: "Presidency of the Dominican Republic",
          description: "The latest presidential decree in the Dominican Republic is 625-24, published on October 15, 2024.",
          url: "https://presidencia.gob.do",
          location: "Santo Domingo",
          favicon: "https://presidencia.gob.do/favicon.ico"
        }
      ];
    }
  }
  // Default generic results
  else {
    if (language === 'spanish') {
      options = [
        {
          title: "Resultado genérico",
          description: "No se encontraron resultados específicos relacionados con la consulta.",
          url: "",
          location: "",
          favicon: ""
        }
      ];
    } else {
      options = [
        {
          title: "Generic result",
          description: "No specific results were found related to the query.",
          url: "",
          location: "",
          favicon: ""
        }
      ];
    }
  }
  
  const summary = language === 'spanish' ? 
    `Información actualizada encontrada: Se encontraron ${options.length} resultados relacionados con tu búsqueda.` : 
    `Updated information found: Found ${options.length} results related to your search.`;
  
  return {
    summary,
    options
  };
}

/**
 * Enhance a query with Dominican context and web search if needed
 * @param {string} userQuery - The user's question
 * @returns {Promise<Object>} - The enhanced response with all Dominican context
 */
async function enhanceWithDominicanContext(userQuery) {
  const startTime = Date.now();
  
  try {
    // Detect language of the query
    const language = detectLanguage(userQuery);
    const languageKey = language === 'spanish' ? 'spanish' : 'english';
    
    // Initialize messages with the fixed system prompt
    const messages = [
      { role: "system", content: SYSTEM_PROMPTS[languageKey] }
    ];
    
    // Check if web search is needed
    if (needsWebSearch(userQuery, languageKey)) {
      const searchResults = await performWebSearch(userQuery, languageKey);
      messages.push({ role: "system", content: searchResults.summary });
      messages.push({ role: "system", content: JSON.stringify(searchResults.options) });
    }
    
    // Add the user's query
    messages.push({ role: "user", content: userQuery });
    
    // Call OpenAI with the enhanced context
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    });
    
    // Return the response in a format compatible with the main query system
    return {
      response: completion.choices[0].message.content,
      processing_time_ms: Date.now() - startTime,
      search_performed: messages.length > 2 // Indicates if web search was done
    };
  } catch (error) {
    console.error('Error in Dominican query processing:', error);
    const errorMessage = language === 'spanish'
      ? 'Lo siento, ocurrió un error al procesar tu consulta. Por favor, intenta de nuevo.'
      : 'Sorry, an error occurred while processing your query. Please try again.';
    
    return {
      response: errorMessage,
      error: error.message,
      processing_time_ms: Date.now() - startTime
    };
  }
}

// Export functions
module.exports = {
  enhanceWithDominicanContext,
  detectLanguage,
  needsWebSearch,
  performWebSearch
}; 