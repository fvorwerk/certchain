const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Store for registered nodes
const nodesFile = path.join(__dirname, 'data', 'nodes.json');
const heartbeatsFile = path.join(__dirname, 'data', 'heartbeats.json');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize nodes store
let nodes = {};
let heartbeats = {};

// Load existing nodes if available
try {
    if (fs.existsSync(nodesFile)) {
        nodes = JSON.parse(fs.readFileSync(nodesFile, 'utf8'));
        console.log(`Loaded ${Object.keys(nodes).length} nodes from file`);
    }
    
    if (fs.existsSync(heartbeatsFile)) {
        heartbeats = JSON.parse(fs.readFileSync(heartbeatsFile, 'utf8'));
    }
} catch (error) {
    console.error('Error loading nodes data:', error.message);
    // Continue with empty nodes object
}

// Save nodes to file
function saveNodes() {
    try {
        fs.writeFileSync(nodesFile, JSON.stringify(nodes, null, 2));
    } catch (error) {
        console.error('Error saving nodes data:', error.message);
    }
}

// Save heartbeats to file
function saveHeartbeats() {
    try {
        fs.writeFileSync(heartbeatsFile, JSON.stringify(heartbeats, null, 2));
    } catch (error) {
        console.error('Error saving heartbeats data:', error.message);
    }
}

// Register a new node
app.post('/register', (req, res) => {
    const { nodeUrl, nodeId, capabilities } = req.body;
    
    if (!nodeUrl) {
        return res.status(400).json({ error: 'Node URL is required' });
    }
    
    nodes[nodeUrl] = {
        nodeId: nodeId || 'unknown',
        capabilities: capabilities || ['certificates'],
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
    };
    
    heartbeats[nodeUrl] = new Date().toISOString();
    
    saveNodes();
    saveHeartbeats();
    
    console.log(`Node registered: ${nodeUrl} (${nodeId || 'unknown'})`);
    
    res.status(201).json({
        message: 'Node registered successfully',
        nodeCount: Object.keys(nodes).length
    });
});

// Get all active nodes
app.get('/nodes', (req, res) => {
    // Clean up inactive nodes (no heartbeat in last 10 minutes)
    const now = new Date();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    Object.keys(heartbeats).forEach(nodeUrl => {
        const lastHeartbeat = new Date(heartbeats[nodeUrl]);
        if (now - lastHeartbeat > inactiveThreshold) {
            console.log(`Removing inactive node: ${nodeUrl}`);
            delete nodes[nodeUrl];
            delete heartbeats[nodeUrl];
        }
    });
    
    // Save changes if any nodes were removed
    saveNodes();
    saveHeartbeats();
    
    // Return active nodes list
    const activeNodeUrls = Object.keys(nodes);
    
    res.json({
        nodeCount: activeNodeUrls.length,
        nodes: activeNodeUrls
    });
});

// Update node heartbeat
app.post('/heartbeat', (req, res) => {
    const { nodeUrl } = req.body;
    
    if (!nodeUrl || !nodes[nodeUrl]) {
        return res.status(400).json({ error: 'Unknown node or missing URL' });
    }
    
    const now = new Date().toISOString();
    nodes[nodeUrl].lastSeen = now;
    heartbeats[nodeUrl] = now;
    
    saveHeartbeats();
    
    res.json({
        message: 'Heartbeat received',
        timestamp: now
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        activeNodes: Object.keys(nodes).length
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Discovery service running on port ${PORT}`);
});

// Periodically clean up inactive nodes
setInterval(() => {
    const now = new Date();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    let removed = 0;
    
    Object.keys(heartbeats).forEach(nodeUrl => {
        const lastHeartbeat = new Date(heartbeats[nodeUrl]);
        if (now - lastHeartbeat > inactiveThreshold) {
            delete nodes[nodeUrl];
            delete heartbeats[nodeUrl];
            removed++;
        }
    });
    
    if (removed > 0) {
        console.log(`Cleaned up ${removed} inactive nodes`);
        saveNodes();
        saveHeartbeats();
    }
}, 5 * 60 * 1000); // Check every 5 minutes
