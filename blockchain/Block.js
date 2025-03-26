const { calculateHash } = require('../utils/hash');

class Block {
    constructor(index, timestamp, data, previousHash, hash = null) {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = hash || this.calculateHash();
    }
    
    calculateHash() {
        return calculateHash(
            this.index,
            this.timestamp,
            this.data,
            this.previousHash
        );
    }
    
    isValid() {
        // Check if the hash is correct
        const calculatedHash = this.calculateHash();
        return this.hash === calculatedHash;
    }
}

module.exports = { Block };
