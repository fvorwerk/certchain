const { CreditToken } = require('./CreditToken');
const { Blockchain } = require('../blockchain/Blockchain');
const { Block } = require('../blockchain/Block');
const fs = require('fs');
const path = require('path');

class CreditLedger {
    constructor() {
        this.tokens = new Map(); // All tokens by tokenId
        this.walletTokens = new Map(); // Map of walletId to set of owned tokenIds
        this.ledgerFile = path.join(__dirname, 'credit-ledger.json');
        this.loadLedger();
    }

    // Load tokens from storage
    loadLedger() {
        try {
            if (fs.existsSync(this.ledgerFile)) {
                const data = JSON.parse(fs.readFileSync(this.ledgerFile, 'utf8'));
                
                // Reconstruct tokens
                this.tokens = new Map();
                this.walletTokens = new Map();
                
                data.tokens.forEach(tokenData => {
                    const token = Object.assign(new CreditToken(), tokenData);
                    this.tokens.set(token.tokenId, token);
                    
                    // Update wallet tokens map
                    if (!this.walletTokens.has(token.ownerWalletId)) {
                        this.walletTokens.set(token.ownerWalletId, new Set());
                    }
                    this.walletTokens.get(token.ownerWalletId).add(token.tokenId);
                });
                
                console.log(`Loaded ${this.tokens.size} credit tokens from ledger`);
            } else {
                console.log('No credit ledger found, starting with empty ledger');
            }
        } catch (error) {
            console.error('Error loading credit ledger:', error);
        }
    }

    // Save tokens to storage
    saveLedger() {
        try {
            const dirPath = path.dirname(this.ledgerFile);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            
            const data = {
                tokens: Array.from(this.tokens.values())
            };
            
            fs.writeFileSync(this.ledgerFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving credit ledger:', error);
        }
    }

    // Replace the recordOnBlockchain method with a real implementation
    async recordOnBlockchain(operation, tokenData, blockchain) {
        if (!blockchain) {
            console.warn("Warning: No blockchain provided for credit operation recording");
            return { success: true, transactionData: tokenData };
        }
        
        // Create a special transaction for the blockchain
        const transactionData = {
            operation,
            token: tokenData,
            timestamp: Date.now()
        };
        
        // Add the transaction to the blockchain's pending certificates
        const success = blockchain.processCreditOperation(operation, transactionData);
        
        return {
            success,
            transactionData
        };
    }

    // Add this method to rebuild the token state from blockchain data
    rebuildFromBlockchain(blockchain) {
        if (!blockchain || !blockchain.chain) {
            console.error("Cannot rebuild token state: Valid blockchain required");
            return false;
        }
        
        console.log("Rebuilding token state from blockchain data...");
        
        // Reset current token state
        this.tokens = new Map();
        this.walletTokens = new Map();
        
        // Iterate through all blocks
        for (const block of blockchain.chain) {
            // Skip the genesis block
            if (block.index === 0) continue;
            
            // Process each transaction in the block
            for (const entry of block.data) {
                // Only process credit operations
                if (entry.type === 'CREDIT_OPERATION') {
                    this.processBlockchainCreditOperation(entry);
                }
            }
        }
        
        console.log(`Rebuilt token state: ${this.tokens.size} tokens in ${this.walletTokens.size} wallets`);
        this.saveLedger(); // Save the rebuilt state
        return true;
    }

    // Process a single credit operation from the blockchain
    processBlockchainCreditOperation(transaction) {
        const { operation, token, timestamp } = transaction.tokenData;
        
        switch (operation) {
            case 'ISSUE':
                // Recreate the token in our ledger
                if (!this.tokens.has(token.tokenId)) {
                    const newToken = Object.assign(new CreditToken(), token);
                    this.tokens.set(newToken.tokenId, newToken);
                    
                    // Update wallet tokens map
                    if (!this.walletTokens.has(newToken.ownerWalletId)) {
                        this.walletTokens.set(newToken.ownerWalletId, new Set());
                    }
                    this.walletTokens.get(newToken.ownerWalletId).add(newToken.tokenId);
                }
                break;
                
            case 'TRANSFER':
                if (this.tokens.has(token.tokenId)) {
                    const existingToken = this.tokens.get(token.tokenId);
                    const fromWalletId = token.transferHistory[token.transferHistory.length - 2]?.fromWalletId;
                    const toWalletId = token.ownerWalletId;
                    
                    // Update token ownership
                    existingToken.ownerWalletId = toWalletId;
                    existingToken.transferHistory = token.transferHistory;
                    
                    // Update wallet mappings
                    if (fromWalletId && this.walletTokens.has(fromWalletId)) {
                        this.walletTokens.get(fromWalletId).delete(token.tokenId);
                    }
                    
                    if (!this.walletTokens.has(toWalletId)) {
                        this.walletTokens.set(toWalletId, new Set());
                    }
                    this.walletTokens.get(toWalletId).add(token.tokenId);
                }
                break;
                
            case 'SPEND':
                if (this.tokens.has(token.tokenId)) {
                    const existingToken = this.tokens.get(token.tokenId);
                    existingToken.spent = true;
                    existingToken.spentOn = token.spentOn;
                    existingToken.spentTimestamp = token.spentTimestamp;
                }
                break;
        }
    }

    // Issue a new credit token to a wallet
    issueToken(walletId, blockchain = null) {
        const token = new CreditToken(walletId);
        
        // Store the token
        this.tokens.set(token.tokenId, token);
        
        // Update wallet tokens map
        if (!this.walletTokens.has(walletId)) {
            this.walletTokens.set(walletId, new Set());
        }
        this.walletTokens.get(walletId).add(token.tokenId);
        
        // Save updated ledger
        this.saveLedger();
        
        // Record on blockchain if provided
        if (blockchain) {
            this.recordOnBlockchain('ISSUE', token, blockchain);
        }
        
        return token;
    }

    // Issue multiple tokens at once
    issueTokens(walletId, count, blockchain = null) {
        const tokens = [];
        for (let i = 0; i < count; i++) {
            tokens.push(this.issueToken(walletId, blockchain));
        }
        return tokens;
    }

    // Get all tokens owned by a wallet
    getWalletTokens(walletId) {
        const tokenIds = this.walletTokens.get(walletId) || new Set();
        return Array.from(tokenIds).map(id => this.tokens.get(id));
    }

    // Get available (unspent) tokens owned by a wallet
    getAvailableTokens(walletId) {
        return this.getWalletTokens(walletId).filter(token => !token.spent);
    }

    // Get wallet balance (number of unspent tokens)
    getWalletBalance(walletId) {
        return this.getAvailableTokens(walletId).length;
    }

    // Spend tokens from a wallet (for certificate creation)
    spendTokens(walletId, count, certificateId, blockchain = null) {
        const availableTokens = this.getAvailableTokens(walletId);
        
        if (availableTokens.length < count) {
            return {
                success: false,
                error: 'Insufficient credits',
                available: availableTokens.length,
                required: count
            };
        }
        
        // Spend the required number of tokens
        const spentTokens = availableTokens.slice(0, count);
        
        spentTokens.forEach(token => {
            token.markAsSpent(certificateId);
            
            // Record on blockchain if provided
            if (blockchain) {
                this.recordOnBlockchain('SPEND', token, blockchain);
            }
        });
        
        // Save updated ledger
        this.saveLedger();
        
        return {
            success: true,
            spentTokens: spentTokens.map(t => t.tokenId),
            remainingBalance: this.getWalletBalance(walletId)
        };
    }

    // Transfer tokens between wallets
    transferTokens(fromWalletId, toWalletId, amount, blockchain) {
        const fromTokensSet = this.walletTokens.get(fromWalletId);
        const toTokensSet = this.walletTokens.get(toWalletId) || new Set();

        if (!fromTokensSet || fromTokensSet.size < amount) {
            return { success: false, error: 'Insufficient tokens' };
        }

        // Convert Set to Array for manipulation
        const fromTokensArray = Array.from(fromTokensSet);
        const tokensToTransfer = fromTokensArray.splice(0, amount);

        tokensToTransfer.forEach(tokenId => {
            const token = this.tokens.get(tokenId);
            if (token) {
                // Update token ownership
                token.ownerWalletId = toWalletId;

                // Remove token from the sender's wallet
                fromTokensSet.delete(tokenId);

                // Add token to the recipient's wallet
                toTokensSet.add(tokenId);
            }
        });

        // Update walletTokens map
        this.walletTokens.set(fromWalletId, fromTokensSet);
        this.walletTokens.set(toWalletId, toTokensSet);

        // Save updated ledger
        this.saveLedger();

        return { success: true, transferredTokens: tokensToTransfer };
    }

    // Get detailed information about all tokens
    getLedgerInfo() {
        const stats = {
            totalTokens: this.tokens.size,
            activeTokens: Array.from(this.tokens.values()).filter(t => !t.spent).length,
            spentTokens: Array.from(this.tokens.values()).filter(t => t.spent).length,
            walletCount: this.walletTokens.size,
            walletBalances: {}
        };
        
        // Calculate balances for each wallet
        for (const [walletId, tokenIds] of this.walletTokens.entries()) {
            const availableCount = Array.from(tokenIds)
                .map(id => this.tokens.get(id))
                .filter(token => !token.spent)
                .length;
                
            stats.walletBalances[walletId] = availableCount;
        }
        
        return stats;
    }

    // Add a method to sync wallet from peer data
    syncWalletFromPeer(walletId, peerTokens) {
        const localTokens = this.walletTokens.get(walletId) || [];
        const updatedTokens = new Map();

        peerTokens.forEach(peerToken => {
            const existingToken = localTokens.find(t => t.tokenId === peerToken.tokenId);
            if (!existingToken) {
                updatedTokens.set(peerToken.tokenId, peerToken);
            }
        });

        this.walletTokens.set(walletId, [...localTokens, ...updatedTokens.values()]);
        this.saveLedger();
    }
}

// Create singleton
const creditLedger = new CreditLedger();
module.exports = creditLedger;
