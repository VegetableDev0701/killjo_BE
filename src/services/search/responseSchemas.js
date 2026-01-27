/**
 * Response Schemas for Search and Chat
 */

/**
 * Marketplace Search Response
 * @typedef {Object} MarketplaceSearchResponse
 * @property {string} type - 'search'
 * @property {string} category - Category of results (vehicles, products, real_estate)
 * @property {string} searchSessionId
 * @property {Array<Object>} results - Array of result objects (with category field)
 * @property {Object} pagination - Pagination info
 * @property {number} pagination.currentPage
 * @property {number} pagination.totalPages
 * @property {number} pagination.totalItems
 * @property {number} pagination.itemsPerPage
 * @property {number} confidence
 * @property {string} language
 * @property {string} [sqlQuery]
 */

/**
 * AI Answer Response
 * @typedef {Object} AIAnswerResponse
 * @property {string} type - 'ai_answer'
 * @property {string} answer - AI-generated answer
 * @property {number} confidence
 * @property {string} language
 */

/**
 * Websearch Response
 * @typedef {Object} WebsearchResponse
 * @property {string} type - 'websearch'
 * @property {string} answer - AI-generated web summary
 * @property {Array<Object>} sources - Array of web sources (title, url, snippet)
 * @property {number} confidence
 * @property {string} language
 */

