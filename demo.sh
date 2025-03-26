#!/bin/bash

# This script demonstrates the use of the generate-certificates.js tool

# Make the script executable
chmod +x generate-certificates.js

echo "1. Generating 3 certificates for node 1 (port 3001)..."
node generate-certificates.js -n 3 -h http://localhost:3001

echo -e "\n2. Mining the block on node 1..."
curl -X POST http://localhost:3001/mine

echo -e "\n3. Generating 2 certificates for node 2 (port 3002)..."
node generate-certificates.js -n 2 -h http://localhost:3002 -m

echo -e "\n4. Checking chain status on all nodes..."
echo "Node 1 chain:"
curl -s http://localhost:3001/chain | jq '.length'
echo "Node 2 chain:"
curl -s http://localhost:3002/chain | jq '.length'
echo "Node 3 chain:"
curl -s http://localhost:3003/chain | jq '.length'

echo -e "\n5. Resolving consensus on node 3..."
curl -X GET http://localhost:3003/nodes/resolve

echo -e "\n6. Checking final chain status..."
echo "Node 3 chain after consensus:"
curl -s http://localhost:3003/chain | jq '.length'
