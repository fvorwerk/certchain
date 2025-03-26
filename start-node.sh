#!/bin/sh
set -e

echo "Setting up CertChain node..."

# Ensure all necessary directories exist
mkdir -p /app/config
mkdir -p /app/blocks
mkdir -p /app/credit

# Copy all necessary files
cp -r /app_source/* /app/
cp -r /app_source/.* /app/ 2>/dev/null || true

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Start the node
echo "Starting CertChain node..."
exec node index.js
