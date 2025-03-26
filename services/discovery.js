const axios = require('axios');
const config = require('../config/config');

class DiscoveryService {
    constructor() {
        this.discoveryUrl = config.discoveryService;
        this.publicUrl = config.publicUrl;
        this.registered = false;
    }

    // Register this node with discovery service
    async register() {
        if (!this.discoveryUrl || !this.publicUrl) {
            console.log('Discovery service or public URL not configured, skipping registration');
            return false;
        }

        try {
            const response = await axios.post(`${this.discoveryUrl}/register`, {
                nodeUrl: this.publicUrl,
                capabilities: ['certificates', 'credits'],
                nodeId: process.env.NODE_ID || 'unknown'
            });
            
            console.log('Successfully registered with discovery service:', response.data);
            this.registered = true;
            return true;
        } catch (error) {
            console.error('Failed to register with discovery service:', error.message);
            return false;
        }
    }

    // Get list of active nodes from discovery service
    async discoverNodes() {
        if (!this.discoveryUrl) {
            console.log('Discovery service not configured, skipping discovery');
            return [];
        }

        try {
            const response = await axios.get(`${this.discoveryUrl}/nodes`);
            if (response.data && Array.isArray(response.data.nodes)) {
                console.log(`Discovered ${response.data.nodes.length} nodes from service`);
                return response.data.nodes;
            }
            return [];
        } catch (error) {
            console.error('Failed to discover nodes:', error.message);
            return [];
        }
    }

    // Perform a heartbeat to keep registration active
    async heartbeat() {
        if (!this.discoveryUrl || !this.publicUrl || !this.registered) {
            return false;
        }

        try {
            await axios.post(`${this.discoveryUrl}/heartbeat`, {
                nodeUrl: this.publicUrl,
                nodeId: process.env.NODE_ID || 'unknown'
            });
            return true;
        } catch (error) {
            console.error('Failed to send heartbeat:', error.message);
            this.registered = false;
            return false;
        }
    }
}

module.exports = new DiscoveryService();
