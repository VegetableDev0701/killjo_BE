/**
 * Validates if a string is a valid UUID v4
 * @param {string} uuid - The UUID string to validate
 * @returns {boolean} - True if valid UUID v4, false otherwise
 */
const validateUUID = (uuid) => {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof uuid === 'string' && uuidV4Regex.test(uuid);
};

/**
 * Validates if a string is a valid email address
 * @param {string} email - The email string to validate
 * @returns {boolean} - True if valid email, false otherwise
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
};

/**
 * Validates if a string is not empty and within length limits
 * @param {string} str - The string to validate
 * @param {number} minLength - Minimum length (default: 1)
 * @param {number} maxLength - Maximum length (default: 255)
 * @returns {boolean} - True if valid string, false otherwise
 */
const validateString = (str, minLength = 1, maxLength = 255) => {
  return typeof str === 'string' && 
         str.length >= minLength && 
         str.length <= maxLength;
};

/**
 * Validates if a number is within specified range
 * @param {number} num - The number to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean} - True if valid number, false otherwise
 */
const validateNumber = (num, min, max) => {
  return typeof num === 'number' && 
         !isNaN(num) && 
         num >= min && 
         num <= max;
};

/**
 * Validates if an object has all required properties
 * @param {Object} obj - The object to validate
 * @param {string[]} requiredProps - Array of required property names
 * @returns {boolean} - True if all required properties exist, false otherwise
 */
const validateObject = (obj, requiredProps) => {
  if (!obj || typeof obj !== 'object') return false;
  return requiredProps.every(prop => prop in obj);
};

module.exports = {
  validateUUID,
  validateEmail,
  validateString,
  validateNumber,
  validateObject
}; 