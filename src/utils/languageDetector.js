/**
 * Simple language detector to determine if a query is in English or Spanish.
 * This uses a basic heuristic approach by looking for common Spanish words.
 */

// Common Spanish words and particles that are strong indicators of Spanish language
const SPANISH_INDICATORS = [
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'en', 'con', 'por', 'para', 'como', 'que',
  'coches', 'automóviles', 'vehículos', 'autos', 'carro', 'carros',
  'cerca', 'barato', 'baratos', 'barata', 'baratas',
  'nuevo', 'nuevos', 'nueva', 'nuevas',
  'usado', 'usados', 'usada', 'usadas',
  'bueno', 'buenos', 'buena', 'buenas',
  'más', 'menos', 'muy', 'este', 'esta', 'estos', 'estas',
  'dónde', 'cuánto', 'cuánta', 'cuántos', 'cuántas',
  'mi', 'mí', 'tu', 'tú', 'su', 'nuestro', 'nuestra', 'vuestro', 'vuestra'
];

/**
 * Detect language of a given query
 * @param {string} query - The user query to analyze
 * @returns {string} 'es' for Spanish, 'en' for English
 */
function detectLanguage(query) {
  if (!query) {
    return 'en'; // Default to English
  }
  
  // Normalize the query: lowercase and remove punctuation
  const normalizedQuery = query.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split query into words
  const words = normalizedQuery.split(' ');
  
  // Count Spanish indicators
  let spanishCount = 0;
  for (const word of words) {
    if (SPANISH_INDICATORS.includes(word)) {
      spanishCount++;
    }
  }
  
  // If at least 15% of words are Spanish indicators, consider it Spanish
  const threshold = Math.max(1, Math.floor(words.length * 0.15));
  return spanishCount >= threshold ? 'es' : 'en';
}

module.exports = { detectLanguage }; 