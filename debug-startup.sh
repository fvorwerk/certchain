#!/bin/bash

# This script starts a single node in foreground mode for debugging
echo "=== Starting CertChain Node in Debug Mode ==="

# Clean old data
rm -rf blocks/node-1 2>/dev/null
rm -rf credit/*.json 2>/dev/null

# Start the node in foreground mode
NODE_ID=1 PORT=3001 BLOCK_INTERVAL=10 node --trace-warnings index.js

# This will show all console output directly in the terminal
# Press Ctrl+C to stop the node
