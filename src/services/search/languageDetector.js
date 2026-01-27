const { franc } = require('franc');

class LanguageDetector {
  constructor() {
    // Cache for language detection results
    this.cache = new Map();
    this.cacheSize = 1000; // Maximum cache entries
  }

  detect(query) {
    try {
      // Check cache first
      const cachedResult = this.cache.get(query);
      if (cachedResult) {
        return cachedResult;
      }

      // Detect language using franc
      const detectedLang = franc(query);
      
      // Map franc's language codes to our supported languages
      let result;
      switch (detectedLang) {
        case 'spa':
          result = 'es';
          break;
        case 'eng':
          result = 'en';
          break;
        default:
          // Default to English for unsupported languages
          result = 'en';
      }

      // Cache the result
      if (this.cache.size >= this.cacheSize) {
        // Clear the first entry if cache is full
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(query, result);

      return result;
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en'; // Default to English on error
    }
  }

  // Get language name for display
  getLanguageName(langCode) {
    const languages = {
      'en': 'English',
      'es': 'Spanish'
    };
    return languages[langCode] || 'Unknown';
  }
}

module.exports = new LanguageDetector(); 