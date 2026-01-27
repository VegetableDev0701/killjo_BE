const { OpenAI } = require('openai');
const {promptEnglish, promptSpanish}  = require("../../prompts/aiChatPrompt")

class AIChatService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });
  }

  detectLanguage(query) {
    const spanishWords = [
      'que', 'como', 'donde', 'cual', 'porque', 'cuando', 'quien', 'que es',
      'como se', 'donde esta', 'ayuda', 'necesito', 'quiero', 'busco',
      'explica', 'dime', 'cuentame', 'pana', 'mano', 'hermano', 'mami', 'papi',
      'chévere', 'tremendo', 'fino', 'bueno', 'malo', 'excelente', 'terrible'
    ];
    
    const queryLower = query.toLowerCase();
    const spanishMatches = spanishWords.filter(word => queryLower.includes(word)).length;
    const englishMatches = queryLower.split(/\s+/).filter(word => word.length > 2).length;
    
    if (spanishMatches > 0 && (spanishMatches / Math.max(englishMatches, 1)) > 0.2) {
      return 'es';
    }
    
    return 'en';
  }

  async chat(query, options = {}, history = [], userName) {
    try {
      console.log(`🤖 AI chat for: "${query}"`);

      const {language} = options;

      let systemPrompt = language == 'es' ? promptSpanish : promptEnglish;

      query = userName ? `${userName}: ${query}` : query;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...history || [],
          { role: "user", content: query }
        ],
        temperature: 0,
        max_tokens: 500
      });

      const response = completion.choices[0].message.content.trim();
      
      return {
        success: true,
        message: response,
        model: "gpt-4o-mini",
        tokens: completion.usage?.total_tokens || 0,
        language: language
      };
      
    } catch (error) {
      console.error('AI chat error:', error);
      const language = this.detectLanguage(query);
      const fallbackMessage = language === 'es' ?
        "Estoy teniendo problemas procesando tu solicitud en este momento, pana. Por favor, inténtalo de nuevo más tarde." :
        "I'm having trouble processing your request right now. Please try again later.";
      
      return {
        success: false,
        message: fallbackMessage,
        error: error.message,
        language: language
      };
    }
  }



  // Specialized chat methods for different types of questions
  async explainConcept(query) {
    const language = this.detectLanguage(query);
    const enhancedQuery = language === 'es' ? 
      `Por favor explícame: ${query}` : 
      `Please explain: ${query}`;
    return await this.chat(enhancedQuery, { type: 'explanation' });
  }

  async provideAdvice(query) {
    const language = this.detectLanguage(query);
    const enhancedQuery = language === 'es' ? 
      `Necesito consejo sobre: ${query}` : 
      `I need advice about: ${query}`;
    return await this.chat(enhancedQuery, { type: 'advice' });
  }

  async answerHowTo(query) {
    const language = this.detectLanguage(query);
    const enhancedQuery = language === 'es' ? 
      `Cómo: ${query}` : 
      `How to: ${query}`;
    return await this.chat(enhancedQuery, { type: 'how_to' });
  }
}

module.exports = new AIChatService(); 