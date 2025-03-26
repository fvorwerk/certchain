const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class CreditToken {
    constructor(ownerWalletId, issueTimestamp = Date.now()) {
        this.tokenId = uuidv4();
        this.ownerWalletId = ownerWalletId;
        this.issueTimestamp = issueTimestamp;
        this.spent = false;
        this.spentOn = null;
        this.spentTimestamp = null;
        this.certificateId = null;
        this.transferHistory = [];
    }

    // Generate a unique hash for this token
    generateHash() {
        return crypto
            .createHash('sha256')
            .update(`${this.tokenId}:${this.ownerWalletId}:${this.issueTimestamp}`)
            .digest('hex');
    }

    // Mark the token as spent
    markAsSpent(certificateId) {
        if (this.spent) {
            throw new Error('Token already spent');
        }
        this.spent = true;
        this.spentOn = certificateId;
        this.spentTimestamp = Date.now();
        return true;
    }

    // Transfer token to another wallet
    transfer(newOwnerWalletId) {
        if (this.spent) {
            throw new Error('Cannot transfer spent token');
        }

        // Record the transfer in history
        this.transferHistory.push({
            fromWalletId: this.ownerWalletId,
            toWalletId: newOwnerWalletId,
            timestamp: Date.now()
        });

        // Update the owner
        this.ownerWalletId = newOwnerWalletId;
        return true;
    }

    // Verify token is valid and owned by the specified wallet
    verifyOwnership(walletId) {
        return !this.spent && this.ownerWalletId === walletId;
    }

    // For a more secure implementation, we would add signature verification
    // methods here that require a wallet's private key to verify ownership
}

module.exports = { CreditToken };
