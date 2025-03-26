const fs = require('fs');
const path = require('path');
const os = require('os');

// Generate a unique node ID if not specified
function generateNodeId() {
    // Use hash of hostname if NODE_ID=auto
    if (process.env.NODE_ID === 'auto') {
        const hostname = os.hostname();
        let hash = 0;
        for (let i = 0; i < hostname.length; i++) {
            hash = ((hash << 5) - hash) + hostname.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash % 10000); // Between 0-9999
    }
    return process.env.NODE_ID || 'default';
}

// Default configuration
const defaultConfig = {
    development: {
        port: 3000,
        publicUrl: 'http://localhost:3000',
        discoveryService: null,
        useHttps: false,
        autoRegister: false,
        seedNodes: []
    },
    production: {
        port: process.env.PORT || 3000,
        publicUrl: process.env.PUBLIC_URL || null,
        discoveryService: process.env.DISCOVERY_SERVICE || null,
        useHttps: process.env.USE_HTTPS === 'true' || (process.env.PUBLIC_URL && process.env.PUBLIC_URL.startsWith('https')),
        autoRegister: process.env.AUTO_REGISTER === 'true',
        seedNodes: process.env.SEED_NODES ? process.env.SEED_NODES.split(',') : [],
        nodeId: generateNodeId(),
        behindProxy: true // Default to true when in production
    }
};

// Load environment-specific configuration
function loadConfig() {
    const env = process.env.NODE_ENV || 'development';
    let config = { ...defaultConfig[env] };
    
    // Try to load from config file if it exists
    const configFile = path.join(__dirname, `${env}.json`);
    if (fs.existsSync(configFile)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            config = { ...config, ...fileConfig };
        } catch (error) {
            console.error(`Error loading config file ${configFile}:`, error.message);
        }
    }
    
    return config;
}

module.exports = loadConfig();
