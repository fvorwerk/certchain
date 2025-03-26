const { Block } = require('./Block');
const { calculateHash } = require('../utils/hash');
const EventEmitter = require('events');

class Blockchain extends EventEmitter {
    constructor() {
        super();
        this.chain = [];
        this.pendingCertificates = [];
        
        // Create the genesis block
        this.createGenesisBlock();
    }
    
    createGenesisBlock() {
        // Use a fixed timestamp and data for the genesis block to ensure consistency across nodes
        const genesisTimestamp = 1617235200000; // April 1, 2021 00:00:00 UTC
        const headline = "Apr 01, 2021 - CertChain established for secure certificate verification";
        
        const genesisData = [{
            certificate: {
                type: "genesis",
                headline: headline,
                timestamp: genesisTimestamp
            },
            timestamp: genesisTimestamp
        }];
        
        // Use fixed values for consistent hash generation
        const genesisBlock = new Block(
            0,                           // index
            genesisTimestamp,            // timestamp
            genesisData,                 // data
            "0",                         // previousHash
            calculateHash(0, genesisTimestamp, genesisData, "0")  // hash
        );
        
        console.log(`Genesis block created with hash: ${genesisBlock.hash}`);
        
        this.chain.push(genesisBlock);
        this.emit('blockAdded', genesisBlock);
        return genesisBlock;
    }
    
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }
    
    getBlock(index) {
        if (index < 0 || index >= this.chain.length) {
            return null;
        }
        return this.chain[index];
    }
    
    addCertificate(certificate) {
        this.pendingCertificates.push({
            certificate,
            timestamp: Date.now()
        });
        
        return this.chain.length; // Return the index where it will be added
    }
    
    createNewBlock() {
        const previousBlock = this.getLatestBlock();
        const newBlockIndex = previousBlock.index + 1;
        const newBlockTimestamp = Date.now();
        const newBlockData = [...this.pendingCertificates];
        const previousHash = previousBlock.hash;
        
        // Clear pending certificates
        this.pendingCertificates = [];
        
        const newBlock = new Block(
            newBlockIndex,
            newBlockTimestamp,
            newBlockData,
            previousHash
        );
        
        console.log(`Created new block ${newBlockIndex} with previous hash: ${previousHash}`);
        console.log(`New block hash: ${newBlock.hash}`);
        
        this.chain.push(newBlock);
        this.emit('blockAdded', newBlock);
        
        return newBlock;
    }
    
    addExistingBlock(block) {
        // Validate the block
        const previousBlock = this.getLatestBlock();
        
        if (block.index !== previousBlock.index + 1) {
            console.log(`Invalid block index: expected ${previousBlock.index + 1}, got ${block.index}`);
            return false;
        }
        
        if (block.previousHash !== previousBlock.hash) {
            console.log(`Invalid previous hash: expected ${previousBlock.hash}, got ${block.previousHash}`);
            console.log(`Latest block index: ${previousBlock.index}, hash: ${previousBlock.hash}`);
            console.log(`Incoming block index: ${block.index}, previous hash: ${block.previousHash}`);
            return false;
        }
        
        // Verify the hash
        const calculatedHash = calculateHash(
            block.index,
            block.timestamp,
            block.data,
            block.previousHash
        );
        
        if (block.hash !== calculatedHash) {
            console.log(`Invalid hash: expected ${calculatedHash}, got ${block.hash}`);
            return false;
        }
        
        this.chain.push(block);
        this.emit('blockAdded', block);
        
        // If validated and added, emit event for credit operations
        const creditOperations = block.data.filter(entry => entry.type === 'CREDIT_OPERATION');
        if (creditOperations.length > 0) {
            this.emit('creditOperationsAdded', creditOperations, block);
        }
        
        return true;
    }
    
    // Function to reset the chain to just the genesis block
    // Useful for testing or when consensus requires replacing the chain
    resetToGenesis() {
        // Keep only the genesis block
        this.chain = [this.chain[0]];
        this.pendingCertificates = [];
        console.log('Chain reset to genesis block');
        return this.chain[0];
    }
    
    isValidChain(chain) {
        // Compare genesis blocks
        const genesisBlock = chain[0];
        const ourGenesisBlock = this.chain[0];
        
        if (genesisBlock.hash !== ourGenesisBlock.hash) {
            console.log(`Genesis block hashes don't match: ours ${ourGenesisBlock.hash}, theirs ${genesisBlock.hash}`);
            return false;
        }
        
        // Validate each block in the chain
        for (let i = 1; i < chain.length; i++) {
            const currentBlock = chain[i];
            const previousBlock = chain[i - 1];
            
            // Check if the hash is correct
            const calculatedHash = calculateHash(
                currentBlock.index,
                currentBlock.timestamp,
                currentBlock.data,
                currentBlock.previousHash
            );
            
            if (currentBlock.hash !== calculatedHash) {
                console.log(`Block ${i} has invalid hash: expected ${calculatedHash}, got ${currentBlock.hash}`);
                return false;
            }
            
            // Check if the previous hash reference is correct
            if (currentBlock.previousHash !== previousBlock.hash) {
                console.log(`Block ${i} has invalid previous hash: expected ${previousBlock.hash}, got ${currentBlock.previousHash}`);
                return false;
            }
        }
        
        return true;
    }
    
    // Add a method to process credit operations
    processCreditOperation(operation, tokenData) {
        // Create a special transaction for the blockchain
        const creditTransaction = {
            type: 'CREDIT_OPERATION',
            operation: operation,  // 'ISSUE', 'TRANSFER', or 'SPEND'
            tokenData: tokenData,
            timestamp: Date.now()
        };
        
        // Add to pending transactions
        this.pendingCertificates.push(creditTransaction);
        console.log(`Added credit operation to pending transactions: ${operation}`);
        
        return true;
    }
    
    // Add a method to load the blockchain from disk
    loadFromDisk() {
        const blocksDir = getBlocksDirectory(); // Make sure this function is available
        
        if (!fs.existsSync(blocksDir)) {
            console.log(`Blocks directory ${blocksDir} does not exist. Starting with genesis block.`);
            return false;
        }
        
        const blockFiles = fs.readdirSync(blocksDir)
            .filter(file => file.startsWith('block-') && file.endsWith('.json'))
            .sort((a, b) => {
                const indexA = parseInt(a.split('-')[1].split('.')[0]);
                const indexB = parseInt(b.split('-')[1].split('.')[0]);
                return indexA - indexB;
            });
        
        if (blockFiles.length === 0) {
            console.log('No block files found. Starting with genesis block.');
            return false;
        }
        
        this.resetToGenesis();
        
        let loadedCount = 0;
        for (let i = 1; i < blockFiles.length; i++) {
            const blockPath = path.join(blocksDir, blockFiles[i]);
            try {
                const blockData = JSON.parse(fs.readFileSync(blockPath, 'utf8'));
                if (this.addExistingBlock(blockData)) {
                    loadedCount++;
                } else {
                    console.error(`Failed to add block from ${blockPath}`);
                    break;
                }
            } catch (error) {
                console.error(`Error loading block from ${blockPath}:`, error);
                break;
            }
        }
        
        console.log(`Loaded ${loadedCount} blocks from disk`);
        this.emit('loaded');
        
        return loadedCount > 0;
    }
}

module.exports = { Blockchain };
