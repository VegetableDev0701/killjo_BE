const axios = require('axios');
const { OpenAI } = require('openai');

class WebSearchService {
  constructor() {
    this.braveApiKey = process.env.BRAVE_API_KEY || "BSAoryuCB8x-4_dRu3pOgbppK3GEjN8";
    this.serpApiKey = process.env.SERP_API_KEY;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    }); 
  }

  async search(query, page = 1, limit = 10, language) {
    try {
      console.log(`🌐 Web search for: "${query}"`);
      
    
      // Enhance query for Dominican Republic focus
      const enhancedQuery = this.enhanceQueryForDR(query, language);
      console.log(`🔍 Enhanced query: "${enhancedQuery}"`);
      
      // Try Brave Search first (if API key is available)
      if (this.braveApiKey) {
        return await this.braveSearch(enhancedQuery, page, limit, language);
      }
      
      // Fallback to SerpAPI (if API key is available)
      if (this.serpApiKey) {
        return await this.serpSearch(enhancedQuery, page, limit, language);
      }
      
      // Fallback response when no API keys are available
      return this.getFallbackResponse(query, language);
      
    } catch (error) {
      console.error('Web search error:', error);
      return this.getFallbackResponse(query, 'en');
    }
  }

  detectLanguage(query) {
    const spanishWords = [
      'busco', 'necesito', 'quiero', 'donde', 'cual', 'como', 'doctor', 'medico',
      'restaurante', 'comida', 'hotel', 'lugar', 'sitio', 'mejor', 'bueno', 'cerca',
      'cerca de', 'en', 'de', 'para', 'con', 'por', 'muy', 'más', 'también',
      'ayuda', 'información', 'dirección', 'teléfono', 'contacto', 'precio',
      'barato', 'caro', 'bueno', 'malo', 'excelente', 'terrible', 'chévere',
      'tremendo', 'fino', 'amigo', 'manito', 'hermano', 'mami', 'papi'
    ];
    
    const queryLower = query.toLowerCase();
    const spanishMatches = spanishWords.filter(word => queryLower.includes(word)).length;
    const englishMatches = queryLower.split(/\s+/).filter(word => word.length > 2).length;
    
    if (spanishMatches > 0 && (spanishMatches / Math.max(englishMatches, 1)) > 0.2) {
      return 'es';
    }
    
    return 'en';
  }

  enhanceQueryForDR(query, language) {
    // Add Dominican Republic context to the query
    const drContext = language === 'es' ? 'República Dominicana' : 'Dominican Republic';
    
    // Don't add if already contains DR context
    if (query.toLowerCase().includes('dominican') || 
        query.toLowerCase().includes('dominicana') || 
        query.toLowerCase().includes('santo domingo') ||
        query.toLowerCase().includes('santiago') ||
        query.toLowerCase().includes('puerto plata')) {
      return query;
    }
    
    return `${query} ${drContext}`;
  }

  async braveSearch(query, page, limit, language) {
    try {
      console.log(`🔍 Attempting Brave Search for: "${query}" (${language})`);
      
      // Simplify parameters to avoid 422 errors
      const params = {
        q: query,
        count: Math.min(limit, 10)
      };
      
      // Only add offset if not first page
      if (page > 1) {
        params.offset = (page - 1) * Math.min(limit, 10);
      }
      
      // Only add language if it's English (Brave API might not support Spanish properly)
      if (language === 'es') {
        params.search_lang = 'es';
      }
      
      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.braveApiKey
        },
        params: params,
        timeout: 10000 // 10 second timeout
      });

      const results = response.data?.web?.results || [];
      
      // Generate AI summary of the search results
      const aiSummary = await this.generateAISummary(query, results, language);
      
      return {
        success: true,
        results: results.map(result => ({
          title: result.title,
          url: result.url,
          description: result.description,
          favicon: this.extractFavicon(result.url),
          source: 'Web Search'
        })),
        totalCount: response.data?.web?.total || results.length,
        page: page,
        hasMore: results.length === Math.min(limit, 10),
        searchEngine: 'Web Search',
        aiSummary: aiSummary
      };
      
    } catch (error) {
      console.error('Brave search error:', error.message);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // Check if it's a network connectivity issue
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.log('🌐 Network connectivity issue with Brave Search API');
        return this.getFallbackResponse(query, language);
      }
      
      // Check if it's an API key or authentication issue
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('🔑 API key authentication issue with Brave Search API');
        return this.getFallbackResponse(query, language, 'API key issue');
      }
      
      // Check if it's a request format issue (422)
      if (error.response?.status === 422) {
        console.log('📝 Request format issue with Brave Search API');
        return this.getFallbackResponse(query, language, 'Request format issue');
      }
      
      // For other errors, return fallback response instead of throwing
      console.log('⚠️  Unknown error with Brave Search API, using fallback');
      return this.getFallbackResponse(query, language, 'Unknown error');
    }
  }

  async generateAISummary(query, searchResults, language) {
    try {
      const isSpanish = language === 'es';
      
      const systemPrompt = isSpanish ? 
        `Eres un asistente AI dominicano muy amigable y respetuoso que resume resultados de búsqueda web. Crea un resumen conciso e informativo que responda directamente a la consulta del usuario basado en los resultados de búsqueda proporcionados.

Directrices:
- Dar respuesta en español
- Sé directo y servicial
- Enfócate en la información más relevante
- Incluye detalles específicos cuando estén disponibles (nombres, ubicaciones, información de contacto)
- Mantén un tono conversacional y natural
- Usa expresiones dominicanas respetuosas como "estimado", "chévere", "tremendo", "fino"
- No menciones "resultados de búsqueda" o "búsqueda web"
- Sé específico sobre República Dominicana cuando sea relevante

**Estructura de Respuesta OBLIGATORIA (SIEMPRE sigue este formato exacto):**

1. Línea Introductoria en Negrita: Comienza con una sola línea en negrita que resuma tu respuesta.
   IMPORTANTE: El símbolo # ya crea formato en negrita. NO uses ** alrededor del #.
   Formato CORRECTO: # Tu línea introductoria aquí
   Formato INCORRECTO: **# Tu línea introductoria aquí** (NO hagas esto)
   (Usa # con espacio, luego tu texto, luego un salto de línea. NO agregues ** antes o después del #)

2. **Secciones Claras**: Usa encabezados de Markdown (##, ###) para organizar el contenido en secciones distintas.
   - Agrega encabezados cortos como "## Mejores Lugares para Visitar" antes de las listas
   - NO uses emojis en las líneas de encabezado (##, ###)

3. **Párrafos Cortos**: Cada párrafo debe tener máximo 2–4 líneas. Divide contenido más largo en múltiples párrafos.

4. **Reglas de Formato**:
   - Resalta términos clave con *negrita* (asteriscos simples)
   - Usa viñetas para listas y comparaciones
   - Mantén los párrafos concisos (2–4 líneas cada uno)
   - Usa emojis (ligeros, con buen gusto) en el contenido y viñetas, pero NO en las líneas de encabezado (##, ###):
     * ⭐ Destacados
     * 🍽️ Restaurantes
     * 🌴 Playas
     * 🛒 Compras
     * 🔥 Recomendaciones populares
     * 📌 Notas breves
     * 👉 Recomendaciones
     * 🟢 Consejos rápidos
     * Agrega otros emojis según sea necesario

5. **Resumen Final**: Termina con un breve resumen de 1–2 líneas sin ningún encabezado. Solo texto plano.

Consulta del usuario: "${query}"

Resultados de búsqueda: ${JSON.stringify(searchResults.slice(0, 5))}

Proporciona un resumen útil que responda a la pregunta del usuario:` :

        `You are a helpful AI assistant that summarizes web search results. Create a concise, informative summary that directly answers the user's query based on the search results provided.

Guidelines:
- Give Response in English
- Be direct and helpful
- Focus on the most relevant information
- Include specific details when available (names, locations, contact info)
- Keep it conversational and natural
- Don't mention "search results" or "web search"
- Format as a natural response to the user's question
- Be specific about Dominican Republic when relevant

**MANDATORY Response Structure (ALWAYS follow this exact format):**

1. Bold Intro Line: Start with a single bold line that summarizes your answer.
   IMPORTANT: The # symbol already creates bold formatting. DO NOT use ** around the #.
   CORRECT Format: # Your bold intro line here
   WRONG Format: **# Your bold intro line here** (DO NOT do this)
   (Use # with space, then your text, then a newline. DO NOT add ** before or after the #)

2. **Clear Sections**: Use Markdown headers (##, ###) to organize content into distinct sections.
   - Add short section headers like "## Top Places to Visit" before lists
   - DO NOT use emojis in header lines (##, ###)

3. **Short Paragraphs**: Each paragraph must be 2–4 lines maximum. Break longer content into multiple paragraphs.

4. **Formatting Rules**:
   - Highlight key terms with *bold* (single asterisks)
   - Use bullet points for lists and comparisons
   - Keep paragraphs concise (2–4 lines each)
   - Use emojis (light, tasteful) in content and bullet points, but NOT in header lines (##, ###):
     * ⭐ Highlights
     * 🍽️ Restaurants
     * 🌴 Beaches
     * 🛒 Shopping
     * 🔥 Hot picks
     * 📌 Short notes
     * 👉 Recommendations
     * 🟢 Quick tips
     * add other emojis as needed

5. **Closing Summary**: End with a brief 1–2 line summary without any header. Just plain text.

User query: "${query}"

Search results: ${JSON.stringify(searchResults.slice(0, 5))}

Provide a helpful summary that answers the user's question:`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      return completion.choices[0].message.content.trim();
      
    } catch (error) {
      console.error('AI summary generation error:', error);
      const fallbackMessage = language === 'es' ? 
        `Encontré varios resultados para "${query}" en República Dominicana. Aquí tienes algunas opciones relevantes que te pueden ayudar, pana.` :
        `I found several results for "${query}" in the Dominican Republic. Here are some relevant options that might help you.`;
      return fallbackMessage;
    }
  }

  extractFavicon(url) {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch (error) {
      return null;
    }
  }

  async serpSearch(query, page, limit, language) {
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: query,
          api_key: this.serpApiKey,
          engine: 'google',
          start: (page - 1) * limit,
          num: limit
        }
      });

      const results = response.data?.organic_results || [];
      
      // Generate AI summary
      const aiSummary = await this.generateAISummary(query, results, language);
      
      return {
        success: true,
        results: results.map(result => ({
          title: result.title,
          url: result.link,
          description: result.snippet,
          favicon: this.extractFavicon(result.link),
          source: 'Web Search'
        })),
        totalCount: response.data?.search_information?.total_results || results.length,
        page: page,
        hasMore: results.length === limit,
        searchEngine: 'Web Search',
        aiSummary: aiSummary
      };
      
    } catch (error) {
      console.error('SerpAPI search error:', error);
      throw error;
    }
  }

  getFallbackResponse(query, language, reason = '') {
    const isSpanish = language === 'es';
    const queryLower = query.toLowerCase();
    
    // Provide specific responses based on query type
    let specificMessage = '';
    let specificSummary = '';
    
    if (queryLower.includes('doctor') || queryLower.includes('medico') || queryLower.includes('healthcare')) {
      specificMessage = isSpanish ? 
        `Para encontrar doctores en República Dominicana, te recomiendo consultar el directorio del Colegio Médico Dominicano o usar aplicaciones como Doctoralia. También puedes buscar en hospitales y clínicas locales.` :
        `To find doctors in the Dominican Republic, I recommend checking the Dominican Medical College directory or using apps like Doctoralia. You can also search in local hospitals and clinics.`;
      specificSummary = isSpanish ?
        `Para doctores en República Dominicana, puedes buscar en el Colegio Médico Dominicano, hospitales locales, o usar aplicaciones médicas. Te puedo ayudar a encontrar opciones específicas.` :
        `For doctors in the Dominican Republic, you can search the Dominican Medical College, local hospitals, or use medical apps. I can help you find specific options.`;
    } else if (queryLower.includes('restaurant') || queryLower.includes('restaurante') || queryLower.includes('comida')) {
      specificMessage = isSpanish ?
        `Para restaurantes en República Dominicana, puedes usar aplicaciones como Uber Eats, Rappi, o buscar en Google Maps. También te recomiendo probar la comida local dominicana.` :
        `For restaurants in the Dominican Republic, you can use apps like Uber Eats, Rappi, or search on Google Maps. I also recommend trying local Dominican food.`;
      specificSummary = isSpanish ?
        `Para restaurantes en República Dominicana, usa Uber Eats, Rappi, o Google Maps. La comida local dominicana es deliciosa - prueba el sancocho, la bandera, y el mofongo.` :
        `For restaurants in the Dominican Republic, use Uber Eats, Rappi, or Google Maps. Local Dominican food is delicious - try sancocho, la bandera, and mofongo.`;
    } else if (queryLower.includes('weather') || queryLower.includes('clima')) {
      specificMessage = isSpanish ?
        `Para el clima en República Dominicana, puedes consultar el Instituto Nacional de Meteorología (ONAMET) o usar aplicaciones como AccuWeather. El clima es tropical todo el año.` :
        `For weather in the Dominican Republic, you can check the National Meteorological Institute (ONAMET) or use apps like AccuWeather. The climate is tropical year-round.`;
      specificSummary = isSpanish ?
        `El clima en República Dominicana es tropical. Consulta ONAMET o AccuWeather para el pronóstico actual. La temporada de lluvias es de mayo a noviembre.` :
        `The climate in the Dominican Republic is tropical. Check ONAMET or AccuWeather for current forecasts. The rainy season is from May to November.`;
    } else {
      specificMessage = isSpanish ?
        `Te ayudo a encontrar información sobre "${query}" en República Dominicana. Puedo buscar servicios locales, lugares e información actualizada para ti.` :
        `I'll help you find information about "${query}" in the Dominican Republic. I can search for local services, places, and up-to-date information for you.`;
      specificSummary = isSpanish ?
        `Estoy aquí para ayudarte con "${query}" en República Dominicana. La búsqueda web está disponible para darte la información más actualizada y relevante.` :
        `I'm here to help you with "${query}" in the Dominican Republic. Web search is available to provide you with the most up-to-date and relevant information.`;
    }
    
    return {
      success: true,
      results: [],
      totalCount: 0,
      page: 1,
      hasMore: false,
      message: specificMessage,
      searchEngine: 'Web Search',
      aiSummary: specificSummary,
      note: reason ? `Note: ${reason}. Web search may need network connectivity to access external APIs.` : 'Web search is available but may need network connectivity to access external APIs.'
    };
  }

  // Specialized search methods for different types of queries
  async searchDoctors(query) {
    const enhancedQuery = `${query} doctor medical healthcare`;
    return await this.search(enhancedQuery);
  }

  async searchRestaurants(query) {
    const enhancedQuery = `${query} restaurant food dining`;
    return await this.search(enhancedQuery);
  }

  async searchWeather(query) {
    const enhancedQuery = `${query} weather forecast`;
    return await this.search(enhancedQuery);
  }

  async searchTouristAttractions(query) {
    const enhancedQuery = `${query} tourist attractions places to visit`;
    return await this.search(enhancedQuery);
  }
}

module.exports = new WebSearchService(); 
