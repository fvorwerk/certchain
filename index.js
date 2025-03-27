const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const https = require('https');
const http = require('http');
const { Blockchain } = require('./blockchain/Blockchain');
const { Block } = require('./blockchain/Block');
const creditBank = require('./credit/CreditBank');
const creditLedger = require('./credit/CreditLedger');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const config = require('./config/config');
const discoveryService = require('./services/discovery');

const app = express();
const PORT = config.port || process.env.PORT || 3000;

// Configure middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

// Swagger configuration
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'CertChain API',
            version: '1.0.0',
            description: 'API documentation for CertChain Node',
        },
        servers: [
            {
                url: config.publicUrl || `http://localhost:${PORT}`,
                description: config.publicUrl ? 'Production server' : 'Local server',
            },
        ],
    },
    apis: [__filename], // Use this file for Swagger annotations
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Initialize blockchain
const blockchain = new Blockchain();

// Store for registered peer nodes
const peers = new Set();
const peersDir = path.join(__dirname, 'config');
const peersFile = path.join(peersDir, `peers${process.env.NODE_ID ? `-${process.env.NODE_ID}` : ''}.json`);

// Create config directory if it doesn't exist
if (!fs.existsSync(peersDir)) {
    fs.mkdirSync(peersDir, { recursive: true });
}

// Function to load peers from file
function loadPeersFromFile() {
    try {
        if (fs.existsSync(peersFile)) {
            const peersData = JSON.parse(fs.readFileSync(peersFile, 'utf8'));
            peersData.forEach(peer => peers.add(peer));
            console.log(`Loaded ${peers.size} peers from ${peersFile}`);
        }
    } catch (error) {
        console.error('Error loading peers from file:', error.message);
    }
}

// Function to save peers to file
function savePeersToFile() {
    try {
        fs.writeFileSync(peersFile, JSON.stringify(Array.from(peers), null, 2));
        console.log(`Saved ${peers.size} peers to ${peersFile}`);
    } catch (error) {
        console.error('Error saving peers to file:', error.message);
    }
}

// Create blocks directory if it doesn't exist
const blocksDir = path.join(__dirname, 'blocks');
if (!fs.existsSync(blocksDir)) {
    fs.mkdirSync(blocksDir);
}

// Create node-specific blocks directory if specified
if (process.env.NODE_ID) {
    const nodeBlocksDir = path.join(blocksDir, `node-${process.env.NODE_ID}`);
    if (!fs.existsSync(nodeBlocksDir)) {
        fs.mkdirSync(nodeBlocksDir);
    }
}

// Function to get the proper directory for blocks based on NODE_ID
function getBlocksDirectory() {
    if (process.env.NODE_ID) {
        return path.join(blocksDir, `node-${process.env.NODE_ID}`);
    }
    return blocksDir;
}

// Save blocks to disk when added
blockchain.on('blockAdded', (block) => {
    const blockPath = path.join(getBlocksDirectory(), `block-${block.index}.json`);
    fs.writeFileSync(blockPath, JSON.stringify(block, null, 2));
    console.log(`Block ${block.index} saved to disk at ${blockPath}`);
});

// Add listener for credit operations in blocks
blockchain.on('creditOperationsAdded', (operations, block) => {
    console.log(`Processing ${operations.length} credit operations from block ${block.index}`);
    
    // Update the credit ledger with these operations
    operations.forEach(operation => {
        creditLedger.processBlockchainCreditOperation(operation);
    });
    
    // Save the ledger state
    creditLedger.saveLedger();
});

// When blockchain is loaded, rebuild credit state if needed
blockchain.on('loaded', () => {
    // When blockchain is loaded, rebuild credit ledger
    creditLedger.rebuildFromBlockchain(blockchain);
});

// Define API routes before static file handling
// Credit system API endpoints
/**
 * @swagger
 * /credits/{walletId}:
 *   get:
 *     summary: Get wallet credit balance
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID
 *     responses:
 *       200:
 *         description: Wallet credit balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 walletId:
 *                   type: string
 *                 balance:
 *                   type: number
 *                 tokensAvailable:
 *                   type: number
 *                 tokensTotal:
 *                   type: number
 */
app.get('/credits/:walletId', async (req, res) => {
    const walletId = req.params.walletId;
    
    // Sync with peers first to ensure we have the latest data
    await syncWalletWithPeers(walletId);
    
    const balance = creditLedger.getWalletBalance(walletId);
    
    res.json({
        walletId,
        balance,
        tokensAvailable: creditLedger.getAvailableTokens(walletId).length,
        tokensTotal: creditLedger.getWalletTokens(walletId).length
    });
});

// Get detailed credit token information
app.get('/credits/:walletId/tokens', async (req, res) => {
    const walletId = req.params.walletId;
    
    // Sync with peers first to ensure we have the latest data
    await syncWalletWithPeers(walletId);
    
    const tokens = creditLedger.getWalletTokens(walletId);
    
    res.json({
        walletId,
        tokenCount: tokens.length,
        availableCount: tokens.filter(t => !t.spent).length,
        tokens: tokens
    });
});

// Purchase credits (mints new NFT tokens)
app.post('/credits/purchase', async (req, res) => {
    const { walletId, amount, paymentReference } = req.body;
    
    if (!walletId || !amount || amount <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Valid wallet ID and positive amount required' 
        });
    }
    
    // In a real system, you would verify the payment here
    
    // Issue the requested number of tokens
    const tokens = creditLedger.issueTokens(walletId, amount, blockchain);
    
    // Broadcast wallet update to peers
    await broadcastWalletUpdate(walletId);
    
    res.status(201).json({
        success: true,
        message: `Issued ${amount} credit tokens to wallet ${walletId}`,
        tokens: tokens.map(t => t.tokenId),
        newBalance: creditLedger.getWalletBalance(walletId)
    });
});

// Transfer credits between wallets
app.post('/credits/transfer', async (req, res) => {
    const { fromWalletId, toWalletId, amount } = req.body;
    
    if (!fromWalletId || !toWalletId || !amount || amount <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Valid wallet IDs and positive amount required' 
        });
    }
    
    // First sync both wallets with peers to ensure we have current balances
    await Promise.all([
        syncWalletWithPeers(fromWalletId),
        syncWalletWithPeers(toWalletId)
    ]);
    
    const result = creditLedger.transferTokens(fromWalletId, toWalletId, amount, blockchain);
    
    if (!result.success) {
        return res.status(400).json(result);
    }
    
    // Broadcast wallet updates to peers
    await Promise.all([
        broadcastWalletUpdate(fromWalletId),
        broadcastWalletUpdate(toWalletId)
    ]);
    
    res.status(200).json(result);
});

// Get ledger information (public but secure)
app.get('/ledger/info', (req, res) => {
    const ledgerInfo = creditLedger.getLedgerInfo();
    const wallets = Array.from(creditLedger.walletTokens.keys());
    const walletDetails = {};
    
    for (const walletId of wallets) {
        const allTokens = creditLedger.getWalletTokens(walletId);
        const activeTokens = creditLedger.getAvailableTokens(walletId);
        
        walletDetails[walletId] = {
            totalTokens: allTokens.length,
            activeTokens: activeTokens.length,
            spentTokens: allTokens.length - activeTokens.length,
            tokenIds: allTokens.map(t => t.tokenId)
        };
    }
    
    res.json({
        ledgerInfo,
        walletDetails,
        tokenDiagnostic: {
            totalTokensInLedger: creditLedger.tokens.size,
            totalActiveTokens: Array.from(creditLedger.tokens.values()).filter(t => !t.spent).length,
            walletMapSize: creditLedger.walletTokens.size
        }
    });
});

// Administrative endpoint to issue free credits
app.post('/admin/credits/issue', (req, res) => {
    const { walletId, amount, reason } = req.body;
    
    if (!walletId || amount <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Valid wallet ID and positive amount required' 
        });
    }
    
    const tokens = creditLedger.issueTokens(walletId, amount, blockchain);
    
    res.status(201).json({
        success: true,
        message: `Issued ${amount} credit tokens to wallet ${walletId}`,
        reason,
        tokens: tokens.map(t => t.tokenId),
        newBalance: creditLedger.getWalletBalance(walletId)
    });
});

// Admin endpoint to get all transactions
app.get('/admin/transactions', (req, res) => {
    const transactions = creditBank.getTransactionHistory();
    
    res.json({
        transactionCount: transactions.length,
        transactions: transactions.slice(0, 50) // Return most recent 50 transactions
    });
});

// Admin endpoint to reset all credits
app.post('/admin/reset-credits', (req, res) => {
    try {
        // Create a backup of the current ledger
        const backupFile = path.join(__dirname, 'credit', `credit-ledger-backup-${Date.now()}.json`);
        fs.copyFileSync(creditLedger.ledgerFile, backupFile);
        
        // Reset the ledger
        creditLedger.tokens = new Map();
        creditLedger.walletTokens = new Map();
        creditLedger.saveLedger();
        
        console.log('Credit ledger has been reset to empty state');
        
        res.json({
            success: true,
            message: 'Credit ledger has been reset',
            backupFile: path.basename(backupFile)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to reset credit ledger'
        });
    }
});

// Add a route to get transactions for a wallet
app.get('/credits/transactions/:walletId', (req, res) => {
    const walletId = req.params.walletId;
    
    if (!walletId) {
        return res.status(400).json({ message: 'Wallet ID is required' });
    }
    
    try {
        const transactions = creditBank.getTransactionHistory(walletId);
        
        res.json({
            walletId,
            transactionCount: transactions.length,
            transactions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get transaction history'
        });
    }
});

// API to get the entire blockchain
app.get('/chain', (req, res) => {
    res.json({
        chain: blockchain.chain,
        length: blockchain.chain.length
    });
});

// API to add a new certificate to the blockchain
app.post('/certificates', (req, res) => {
    const { certificate, walletId } = req.body;
    
    if (!certificate) {
        return res.status(400).json({ message: 'Certificate data is required' });
    }
    
    // Initialize credit result variable
    let creditResult = null;
    
    // Check if this is a paid certificate (requires credits)
    if (walletId) {
        // Each certificate costs 1 credit
        const creditCost = 1;
        
        // Try to spend tokens
        creditResult = creditLedger.spendTokens(walletId, creditCost, certificate.id || certificate.certificateId, blockchain);
        
        if (!creditResult.success) {
            return res.status(402).json({ 
                message: 'Payment Required', 
                error: creditResult.error,
                available: creditResult.available,
                required: creditResult.required
            });
        }
    }
    
    // Continue with certificate creation
    const index = blockchain.addCertificate(certificate);
    
    res.status(201).json({ 
        message: 'Certificate added to pending certificates', 
        blockIndex: index,
        creditTransaction: walletId ? { 
            walletId,
            spentTokens: creditResult.spentTokens,
            newBalance: creditLedger.getWalletBalance(walletId) 
        } : null
    });
});

// API to force block creation immediately (for testing)
app.post('/mine', (req, res) => {
    if (blockchain.pendingCertificates.length === 0) {
        return res.status(400).json({ message: 'No pending certificates to mine' });
    }
    
    const newBlock = blockchain.createNewBlock();
    console.log(`New block created: ${newBlock.index}`);
    broadcastNewBlock(newBlock);
    
    res.json({
        message: 'New block created',
        block: newBlock
    });
});

// API to get a specific block
app.get('/block/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const block = blockchain.getBlock(index);
    
    if (!block) {
        return res.status(404).json({ message: 'Block not found' });
    }
    
    res.json(block);
});

// API to register a new peer node
app.post('/nodes/register', (req, res) => {
    const { nodes } = req.body;
    
    if (!nodes || !Array.isArray(nodes)) {
        return res.status(400).json({ message: 'Please provide an array of nodes' });
    }
    
    for (const node of nodes) {
        peers.add(node);
    }
    
    // Save peers to file
    savePeersToFile();
    
    res.json({
        message: 'New nodes have been added',
        totalNodes: Array.from(peers)
    });
});

// API to initiate consensus algorithm
app.get('/nodes/resolve', async (req, res) => {
    const replaced = await resolveConflicts();
    
    if (replaced) {
        res.json({
            message: 'Our chain was replaced',
            newChain: blockchain.chain
        });
    } else {
        res.json({
            message: 'Our chain is authoritative',
            chain: blockchain.chain
        });
    }
});

// API to get all registered peer nodes
app.get('/nodes', (req, res) => {
    res.json({
        nodes: Array.from(peers)
    });
});

// API to receive a new block from a peer
app.post('/block', (req, res) => {
    const { block } = req.body;
    
    if (!block) {
        return res.status(400).json({ message: 'Block data is required' });
    }
    
    const result = blockchain.addExistingBlock(block);
    
    if (result) {
        res.json({ message: 'Block added successfully' });
    } else {
        res.status(400).json({ message: 'Invalid block' });
    }
});

// API to reset chain to genesis (for testing only)
app.post('/reset', (req, res) => {
    const genesisBlock = blockchain.resetToGenesis();
    console.log('Chain reset to genesis block');
    res.json({
        message: 'Chain reset to genesis block',
        genesisBlock
    });
});

// New API endpoint to get certificates by student ID
app.get('/wallet/:studentId', (req, res) => {
    const studentId = req.params.studentId;
    
    if (!studentId) {
        return res.status(400).json({ message: 'Student ID is required' });
    }
    
    // Search through all blocks for certificates belonging to this student
    const certificates = [];
    
    for (const block of blockchain.chain) {
        // Skip the genesis block as it doesn't contain real certificates
        if (block.index === 0) continue;
        
        for (const entry of block.data) {
            // Skip entries that are not certificates or don't have a certificate property
            if (entry.type === 'CREDIT_OPERATION' || !entry.certificate) continue;
            
            const cert = entry.certificate;
            
            // Safely check if the certificate belongs to the specified student
            if (cert && cert.student && 
                (cert.student.id === studentId || cert.student.fullName === studentId)) {
                
                // Add block info to the certificate
                certificates.push({
                    certificate: cert,
                    timestamp: entry.timestamp,
                    blockIndex: block.index,
                    blockHash: block.hash
                });
            }
        }
    }
    
    res.json({
        studentId,
        certificateCount: certificates.length,
        certificates
    });
});

// Get all registered wallets on the network
app.get('/wallets', (req, res) => {
    const wallets = Array.from(creditLedger.walletTokens.keys());
    const walletDetails = {};
    
    for (const walletId of wallets) {
        const balance = creditLedger.getWalletBalance(walletId);
        walletDetails[walletId] = {
            balance,
            tokensAvailable: creditLedger.getAvailableTokens(walletId).length,
            tokensTotal: creditLedger.getWalletTokens(walletId).length
        };
    }
    
    res.json({
        walletCount: wallets.length,
        wallets: walletDetails
    });
});

// Register a wallet to the network
app.post('/wallets/register', (req, res) => {
    const { walletId } = req.body;
    
    if (!walletId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Wallet ID is required' 
        });
    }
    
    // Initialize the wallet in the ledger if not exists
    if (!creditLedger.walletTokens.has(walletId)) {
        creditLedger.walletTokens.set(walletId, []);
        creditLedger.saveLedger();
    }
    
    res.status(201).json({
        success: true,
        message: `Wallet ${walletId} registered`,
        walletId
    });
});

// Function to sync wallet data with peers
async function syncWalletWithPeers(walletId) {
    if (peers.size === 0) return; // No peers to sync with
    
    const promises = [];
    
    for (const node of peers) {
        const promise = axios.get(`${node}/credits/${walletId}/sync`)
            .then(response => {
                if (response.data && response.data.tokens) {
                    // Update our local wallet with the peer's data if it has more tokens
                    const localTokens = creditLedger.getWalletTokens(walletId);
                    if (response.data.tokens.length > localTokens.length) {
                        console.log(`Syncing wallet ${walletId} from peer ${node} (${response.data.tokens.length} tokens)`);
                        
                        // Update our ledger with the peer's tokens
                        creditLedger.syncWalletFromPeer(walletId, response.data.tokens);
                        creditLedger.saveLedger();
                    }
                }
            })
            .catch(error => {
                console.error(`Failed to sync wallet ${walletId} with ${node}:`, error.message);
            });
        
        promises.push(promise);
    }
    
    await Promise.all(promises);
}

// Function to broadcast wallet update to peers
async function broadcastWalletUpdate(walletId) {
    if (peers.size === 0) return; // No peers to broadcast to
    
    const walletTokens = creditLedger.getWalletTokens(walletId);
    const promises = [];
    
    for (const node of peers) {
        const promise = axios.post(`${node}/credits/${walletId}/update`, { tokens: walletTokens })
            .catch(error => {
                console.error(`Failed to broadcast wallet ${walletId} update to ${node}:`, error.message);
            });
        
        promises.push(promise);
    }
    
    await Promise.all(promises);
}

// Special endpoint for peers to get wallet data for sync
app.get('/credits/:walletId/sync', (req, res) => {
    const walletId = req.params.walletId;
    const tokens = creditLedger.getWalletTokens(walletId);
    
    res.json({
        walletId,
        tokenCount: tokens.length,
        tokens
    });
});

// Special endpoint for peers to update wallet data
app.post('/credits/:walletId/update', (req, res) => {
    const walletId = req.params.walletId;
    const { tokens } = req.body;
    
    if (!tokens || !Array.isArray(tokens)) {
        return res.status(400).json({ message: 'Valid tokens array is required' });
    }
    
    // Only update if the peer has more tokens than we do
    const localTokens = creditLedger.getWalletTokens(walletId);
    if (tokens.length > localTokens.length) {
        creditLedger.syncWalletFromPeer(walletId, tokens);
        creditLedger.saveLedger();
        
        console.log(`Updated wallet ${walletId} from peer (${tokens.length} tokens)`);
    }
    
    res.json({
        success: true,
        message: `Wallet ${walletId} sync processed`,
        updated: tokens.length > localTokens.length
    });
});

// Function to broadcast new block to all peers
async function broadcastNewBlock(block) {
    const promises = [];
    
    for (const node of peers) {
        const promise = axios.post(`${node}/block`, { block })
            .catch(error => {
                console.error(`Failed to send block to ${node}:`, error.message);
            });
        
        promises.push(promise);
    }
    
    await Promise.all(promises);
}

// Function to resolve conflicts (consensus algorithm)
async function resolveConflicts() {
    let maxLength = blockchain.chain.length;
    let longestChain = null;
    
    for (const node of peers) {
        try {
            const response = await axios.get(`${node}/chain`);
            
            const { chain, length } = response.data;
            
            // Check if the chain is longer and valid
            if (length > maxLength && blockchain.isValidChain(chain)) {
                maxLength = length;
                longestChain = chain;
            }
        } catch (error) {
            console.error(`Failed to fetch chain from ${node}:`, error.message);
        }
    }
    
    // Replace our chain if a longer valid chain was found
    if (longestChain) {
        blockchain.chain = longestChain;
        return true;
    }
    
    return false;
}

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        node: {
            id: process.env.NODE_ID || 'default',
            publicUrl: config.publicUrl,
            uptime: process.uptime(),
        },
        blockchain: {
            blocks: blockchain.chain.length,
            pendingCertificates: blockchain.pendingCertificates.length
        },
        credits: creditLedger.getLedgerInfo(),
        peers: Array.from(peers),
    };
    
    res.json(health);
});

// Now serve static files AFTER defining API routes
app.use(express.static(path.join(__dirname, 'frontend')));

// Automated block creation (configurable via environment variable)
const BLOCK_INTERVAL = process.env.BLOCK_INTERVAL 
    ? parseInt(process.env.BLOCK_INTERVAL) * 1000 // Convert seconds to milliseconds
    : 24 * 60 * 60 * 1000; // Default: 24 hours in milliseconds (1 day)

console.log(`Block generation interval set to ${BLOCK_INTERVAL/1000} seconds (${BLOCK_INTERVAL/1000/60/60} hours)`);

// Initialize blockchain and credit system
console.log('Initializing blockchain...');

// Check if we should reset the ledger
if (process.env.RESET_LEDGER === 'true') {
    console.log('RESET_LEDGER flag is set to true - resetting credit ledger...');
    try {
        const backupFile = path.join(__dirname, 'credit', `credit-ledger-backup-${Date.now()}.json`);
        if (fs.existsSync(creditLedger.ledgerFile)) {
            fs.copyFileSync(creditLedger.ledgerFile, backupFile);
            console.log(`Previous ledger backed up to: ${path.basename(backupFile)}`);
        }
        
        // Reset the ledger
        creditLedger.tokens = new Map();
        creditLedger.walletTokens = new Map();
        creditLedger.saveLedger();
        
        console.log('Credit ledger has been reset to empty state');
        
        // Also reset blockchain if needed
        blockchain.resetToGenesis();
        console.log('Blockchain reset to genesis block');
    } catch (error) {
        console.error('Error resetting ledger:', error.message);
    }
}

// Load peers from file
loadPeersFromFile();

// Check if credits need rebuilding
const creditsNeedRebuild = creditLedger.getLedgerInfo().totalTokens === 0;
if (creditsNeedRebuild) {
    console.log('Credit ledger is empty. Rebuilding from blockchain...');
    // Rebuild code here if needed
} else {
    console.log(`Credit ledger already contains ${creditLedger.getLedgerInfo().totalTokens} tokens`);
}

setInterval(() => {
    if (blockchain.pendingCertificates.length > 0) {
        console.log('Creating new block with pending certificates...');
        const newBlock = blockchain.createNewBlock();
        console.log(`New block created: ${newBlock.index}`);
        broadcastNewBlock(newBlock);
    } else {
        console.log('No pending certificates to add to a new block');
    }
}, BLOCK_INTERVAL);

// Move the catch-all route to the very end
// Serve the React app for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Authentication middleware for admin endpoints
function authenticateAdmin(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    
    // In production, use a secure method to validate API keys
    // This is a simple example - implement proper authentication
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ 
            success: false,
            message: 'Unauthorized: Valid API key required for admin actions'
        });
    }
    
    next();
}

// Apply authentication to admin routes
app.use('/admin', authenticateAdmin);

// Create HTTP or HTTPS server based on configuration
let server;

if (config.useHttps) {
    try {
        // Paths to SSL certificate files
        const privateKeyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'config', 'privkey.pem');
        const certificatePath = process.env.SSL_CERT_PATH || path.join(__dirname, 'config', 'fullchain.pem');
        
        if (!fs.existsSync(privateKeyPath) || !fs.existsSync(certificatePath)) {
            console.error('SSL certificates not found, falling back to HTTP');
            server = http.createServer(app);
        } else {
            const httpsOptions = {
                key: fs.readFileSync(privateKeyPath),
                cert: fs.readFileSync(certificatePath)
            };
            server = https.createServer(httpsOptions, app);
            console.log('HTTPS server configured with SSL certificates');
        }
    } catch (error) {
        console.error('Error setting up HTTPS:', error.message);
        console.log('Falling back to HTTP server');
        server = http.createServer(app);
    }
} else {
    server = http.createServer(app);
}

// Start the server
server.listen(PORT, async () => {
    console.log(`Node ${process.env.NODE_ID || 'default'} running on port ${PORT}`);
    
    if (config.publicUrl) {
        console.log(`Public URL configured as: ${config.publicUrl}`);
    } else {
        console.warn('No PUBLIC_URL configured! Peer-to-peer functionality may not work correctly.');
    }
    
    // Try to register with discovery service if configured
    if (config.autoRegister && config.discoveryService) {
        await discoveryService.register();
        
        // Setup discovery heartbeat interval
        setInterval(async () => {
            await discoveryService.heartbeat();
        }, 60000); // Every minute
        
        // Auto-discover peers on startup
        const discoveredNodes = await discoveryService.discoverNodes();
        let newNodesAdded = 0;
        
        for (const node of discoveredNodes) {
            if (node !== config.publicUrl && !peers.has(node)) { // Don't add self or existing peers
                peers.add(node);
                newNodesAdded++;
            }
        }
        
        if (newNodesAdded > 0) {
            console.log(`Added ${newNodesAdded} newly discovered peer nodes`);
            savePeersToFile();
        }
    }
    
    // Add seed nodes if provided
    if (config.seedNodes && config.seedNodes.length > 0) {
        let newSeedNodes = 0;
        
        for (const node of config.seedNodes) {
            if (!peers.has(node)) {
                peers.add(node);
                newSeedNodes++;
            }
        }
        
        if (newSeedNodes > 0) {
            console.log(`Added ${newSeedNodes} seed nodes from configuration`);
            savePeersToFile();
        }
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down node...');
    savePeersToFile();
    console.log('Saved peer information');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    savePeersToFile();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
