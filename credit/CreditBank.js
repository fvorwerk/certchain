const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const creditLedger = require('./CreditLedger');

class CreditBank {
    constructor() {
        this.transactionLog = path.join(__dirname, 'transaction-log.json');
        this.transactions = this.loadTransactions();
    }

    // Load transaction history
    loadTransactions() {
        try {
            if (fs.existsSync(this.transactionLog)) {
                return JSON.parse(fs.readFileSync(this.transactionLog, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
        return []; // Default empty array if file doesn't exist or error occurs
    }

    // Save transactions to storage
    saveTransactions() {
        try {
            const dirPath = path.dirname(this.transactionLog);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            fs.writeFileSync(this.transactionLog, JSON.stringify(this.transactions, null, 2));
        } catch (error) {
            console.error('Error saving transactions:', error);
        }
    }

    // Get credit balance for a wallet - redirects to NFT ledger
    getBalance(walletId) {
        return creditLedger.getWalletBalance(walletId);
    }

    // Add credits to a wallet (purchase) - creates NFT tokens
    addCredits(walletId, amount, paymentReference = null) {
        // Issue NFT tokens through the ledger
        const tokens = creditLedger.issueTokens(walletId, amount);
        
        // Record bank transaction
        const transaction = {
            id: uuidv4(),
            type: 'PURCHASE',
            walletId,
            amount,
            paymentReference,
            tokenIds: tokens.map(t => t.tokenId),
            timestamp: new Date().toISOString(),
            balanceAfter: creditLedger.getWalletBalance(walletId)
        };
        this.transactions.push(transaction);
        this.saveTransactions();

        return {
            success: true,
            transaction,
            tokens: tokens,
            newBalance: creditLedger.getWalletBalance(walletId)
        };
    }

    // Spend credits from a wallet - spends NFT tokens
    spendCredits(walletId, amount, certificateId) {
        // Spend tokens through the ledger
        const result = creditLedger.spendTokens(walletId, amount, certificateId);
        
        if (!result.success) {
            return result;
        }
        
        // Record bank transaction
        const transaction = {
            id: uuidv4(),
            type: 'SPEND',
            walletId,
            amount: -amount,
            certificateId,
            tokenIds: result.spentTokens,
            timestamp: new Date().toISOString(),
            balanceAfter: result.remainingBalance
        };
        this.transactions.push(transaction);
        this.saveTransactions();

        return {
            success: true,
            transaction,
            spentTokens: result.spentTokens,
            newBalance: result.remainingBalance
        };
    }

    // Get transaction history for a wallet
    getTransactionHistory(walletId) {
        // If no walletId is provided, return all transactions
        if (!walletId) {
            return this.transactions;
        }
        // Otherwise filter by walletId
        return this.transactions.filter(tx => tx.walletId === walletId);
    }

    // For administrative purposes, give free credits - issues NFT tokens
    issueCredits(walletId, amount, reason) {
        // Issue NFT tokens through the ledger
        const tokens = creditLedger.issueTokens(walletId, amount);
        
        // Record bank transaction
        const transaction = {
            id: uuidv4(),
            type: 'ISSUE',
            walletId,
            amount,
            reason,
            tokenIds: tokens.map(t => t.tokenId),
            timestamp: new Date().toISOString(),
            balanceAfter: creditLedger.getWalletBalance(walletId)
        };
        this.transactions.push(transaction);
        this.saveTransactions();

        return {
            success: true,
            transaction,
            tokens: tokens,
            newBalance: creditLedger.getWalletBalance(walletId)
        };
    }

    // Get bank statistics
    getBankStats() {
        const ledgerInfo = creditLedger.getLedgerInfo();
        
        return {
            transactions: {
                total: this.transactions.length,
                purchases: this.transactions.filter(tx => tx.type === 'PURCHASE').length,
                issues: this.transactions.filter(tx => tx.type === 'ISSUE').length,
                spends: this.transactions.filter(tx => tx.type === 'SPEND').length
            },
            tokens: ledgerInfo,
            totalVolume: this.transactions.reduce((sum, tx) => 
                sum + (tx.amount > 0 ? tx.amount : 0), 0)
        };
    }
}

// Special initialization function used for first-time setup
function initializeTestWallets() {
    const aliceId = "S1001";
    const bobId = "S2002";
    
    // Check if any wallet has credits already - if so, skip initialization
    // This prevents duplicate token creation across nodes
    const totalLedgerTokens = creditLedger.getLedgerInfo().totalTokens;
    if (totalLedgerTokens > 0) {
        console.log(`Skipping wallet initialization - ledger already has ${totalLedgerTokens} tokens`);
        return;
    }
    
    console.log('No tokens found in ledger, initializing test wallets...');
    
    // Use explicit counts to prevent duplication
    const aliceTokens = 16;
    const bobTokens = 16;
    
    console.log(`Initializing ${aliceTokens} credits for ${aliceId}...`);
    creditLedger.issueTokens(aliceId, aliceTokens);
    
    console.log(`Initializing ${bobTokens} credits for ${bobId}...`);
    creditLedger.issueTokens(bobId, bobTokens);
    
    // Transfer some credits for demo
    try {
        if (creditLedger.getWalletBalance(aliceId) >= 3) {
            console.log(`Transferring 3 credits from ${aliceId} to ${bobId}...`);
            creditLedger.transferTokens(aliceId, bobId, 3);
        }
    } catch (err) {
        console.log("Transfer already happened or failed:", err.message);
    }
}

// Run initialization at module load time
initializeTestWallets();

// Singleton instance
const creditBank = new CreditBank();

module.exports = creditBank;
