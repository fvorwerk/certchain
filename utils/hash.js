const crypto = require('crypto');

/**
 * Calculate a SHA-256 hash of the given inputs
 * @param {...any} inputs - Any number of inputs to be hashed
 * @returns {string} - The resulting hash as a hex string
 */
function calculateHash(...inputs) {
    const data = inputs
        .map(input => {
            if (typeof input === 'object') {
                return JSON.stringify(input);
            }
            return String(input);
        })
        .join('');
    
    return crypto
        .createHash('sha256')
        .update(data)
        .digest('hex');
}

module.exports = { calculateHash };
