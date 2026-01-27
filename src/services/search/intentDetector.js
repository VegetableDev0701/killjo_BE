const { OpenAI } = require('openai');
const  { intentDetectorPrompt } = require('../../prompts/intentDetectorPrompt');
const  { searchFilterExtractionPrompt } = require('../../prompts/searchFilterExtractionPrompt');
const  {categoryKeys } = require('../../data/categoryData.js');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

class IntentDetector {

  /**
   * Guard clause: Detect acknowledgment/terminal messages deterministically
   * Returns TERMINAL intent if detected, null otherwise
   * @param {string} query - User query
   * @returns {Object|null} - TERMINAL intent result or null
   */
  _detectTerminalIntent(query) {
    const normalized = query.toLowerCase().trim();
    
    // Patterns for acknowledgment/terminal messages
    const terminalPatterns = [
      // English
      /^(thank\s*you|thanks|ty|thx)$/i,
      /^(ok|okay|okey|k)$/i,
      /^(perfect|perfecto|got it|understood|alright|all right)$/i,
      /^(sounds good|sounds great|that works|that's fine)$/i,
      // Spanish
      /^(gracias|muchas gracias|mil gracias|ty)$/i,
      /^(ok|okey|vale|listo|perfecto)$/i,
      /^(de acuerdo|entendido|comprendo|está bien|está perfecto)$/i,
      // Short confirmations
      /^(yep|yeah|yes|sí|si|yup|nope|no)$/i,
      /^(cool|nice|genial|chévere|fino)$/i
    ];
    
    // Check if query matches any terminal pattern
    const isTerminal = terminalPatterns.some(pattern => pattern.test(normalized));
    
    if (isTerminal) {
      // Detect language for response
      const isSpanish = /^(gracias|muchas gracias|mil gracias|vale|listo|perfecto|de acuerdo|entendido|comprendo|está bien|está perfecto|sí|si|genial|chévere|fino)$/i.test(normalized);
      const language = isSpanish ? 'es' : 'en';
      
      return {
        intent: 'TERMINAL',
        category: null,
        confidence: 1.0,
        normalized_query: query,
        language: language,
        filters: {},
        keywords: [],
        sort: null,
        source: 'guard_clause',
        sqlQuery: null,
        reason: 'Acknowledgment/terminal message detected',
        fallback: false,
        language_change: null
      };
    }
    
    return null;
  }

  async detectIntent(query, history = []) {
    try {
      // Guard clause: Check for terminal/acknowledgment messages BEFORE any OpenAI call
      const terminalResult = this._detectTerminalIntent(query);
      if (terminalResult) {
        return terminalResult;
      }
      
      // Detect language with fallback (no changes here)
      let lang = 'en';
     
      // A single, unified prompt to handle all logic in one call

      const completion = await openai.chat.completions.create({
        // Use a model that supports JSON mode for best results, e.g., gpt-3.5-turbo-1106 or gpt-4-turbo-preview
        model: "gpt-4o-mini", 
        messages: [
          ...history,
          { role: "system", content: intentDetectorPrompt },
          { role: "user", content: query} 
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" }, 
      });
      
      // The response is now a guaranteed JSON string, so we can parse it directly.
      let result = JSON.parse(completion.choices[0].message.content.trim());

      if(history.length > 1 && history[history.length - 1].role === 'assistant') {
        result.fallback = result.fallback; 
      }else{
        result.fallback = false;
      }

      if (result.intent === 'ASK_FOR_CLARIFICATION') {
        return {
          intent: result.intent,
          confidence: result.confidence || 0.5,
          reason: result.reason || 'Clarification needed',
          asked_Question: result.asked_Question || 'Please clarify your request.',
          source: 'openai_single_call',

        };
      }

      if (result.intent === 'DATABASE_SEARCH') {
        let category = result.category;
        if (!categoryKeys.includes(category)) {
          category = "others"
        }

        const prompt = searchFilterExtractionPrompt[category];

        const completion = await openai.chat.completions.create({
          // Use a model that supports JSON mode for best results, e.g., gpt-3.5-turbo-1106 or gpt-4-turbo-preview
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: result.normalized_query}
          ],
          temperature: 0.1,
          max_tokens: 500,
          response_format: { type: "json_object" },
        });

        result.filters = JSON.parse(completion.choices[0].message.content.trim());
        result.filters['general_names'] = result.general_names || [];
      }

      return {
        intent: result.intent || 'AI_CHAT',
        category: result.category || null,
        confidence: result.confidence || 0.7,
        normalized_query: result.normalized_query ,
        language: result.language || lang,
        filters: result.filters || {},
        keywords: result.keywords || [],
        sort: result.sort || null,
        source: 'openai_single_call',
        sqlQuery: null,
        reason: result.reason || 'Default fallback',
        fallback: result.fallback || false,
        language_change: result.language_change || null
      };

    } catch (error) {
      console.error('Optimized intent detection error:', error);
      // Fallback logic remains the same in case of an API error.
      return this.fallbackIntentAnalysis(query);
    }
  }
  // Fallback intent analysis using keyword matching
  fallbackIntentAnalysis(query) {
    const lower = query.toLowerCase();
    
    // Database search indicators
    const dbKeywords = [
      'buy', 'purchase', 'looking for', 'need', 'want', 'show me', 'find', 'search',
      'available', 'for sale', 'price', 'car', 'vehicle', 'house', 'apartment',
      'property', 'laptop', 'computer', 'phone', 'furniture', 'electronics'
    ];
    
    // Web search indicators (expanded for medical/healthcare and tourist attractions)
    const webKeywords = [
      'near me', 'nearby', 'local', 'doctor', 'dentist', 'hospital', 'clinic', 'medical',
      'healthcare', 'physician', 'surgeon', 'specialist', 'restaurant', 'hotel', 'gas station',
      'weather', 'news', 'events', 'places', 'pharmacy', 'bank', 'gym', 'school', 'university',
      'airport', 'bus station', 'train station', 'police', 'fire', 'emergency', 'best spots',
      'tourist', 'attractions', 'historical', 'history', 'museum', 'park', 'beach', 'visiting',
      'vacation', 'travel', 'tourism', 'guide', 'recommendations', 'top places', 'must see'
    ];
    
    // Medical/healthcare specific keywords (high priority for web search)
    const medicalKeywords = [
      'doctor', 'dentist', 'hospital', 'clinic', 'medical', 'healthcare', 'physician',
      'surgeon', 'specialist', 'nurse', 'therapist', 'psychiatrist', 'psychologist',
      'pediatrician', 'cardiologist', 'dermatologist', 'orthopedic', 'neurologist',
      'emergency', 'urgent care', 'primary care', 'family doctor'
    ];
    
    const dbMatches = dbKeywords.filter(keyword => lower.includes(keyword)).length;
    const webMatches = webKeywords.filter(keyword => lower.includes(keyword)).length;
    const medicalMatches = medicalKeywords.filter(keyword => lower.includes(keyword)).length;
    
    // Medical queries should always go to web search
    if (medicalMatches > 0) {
      return {
        intent: 'WEB_SEARCH',
        category: null,
        confidence: 0.95,
        normalized_query: query,
        filters: {},
        keywords: [],
        sort: null,
        source: 'fallback',
        sqlQuery: null,
        reason: 'Medical/healthcare query detected'
      };
    }
    
    if (dbMatches > webMatches && dbMatches > 0) {
      return {
        intent: 'DATABASE_SEARCH',
        category: 'products', // Default to products
        confidence: 0.8,
        normalized_query: query,
        filters: {},
        keywords: [],
        sort: null,
        source: 'fallback',
        sqlQuery: null,
        reason: 'Contains purchase/search keywords'
      };
    } else if (webMatches > 0) {
      return {
        intent: 'WEB_SEARCH',
        category: null,
        confidence: 0.8,
        normalized_query: query,
        filters: {},
        keywords: [],
        sort: null,
        source: 'fallback',
        sqlQuery: null,
        reason: 'Contains local service/place keywords'
      };
    } else {
      return {
        intent: 'AI_CHAT',
        category: null,
        confidence: 0.7,
        normalized_query: query,
        filters: {},
        keywords: [],
        sort: null,
        source: 'fallback',
        sqlQuery: null,
        reason: 'General question or conversation'
      };
    }
  }
}

module.exports = new IntentDetector(); 