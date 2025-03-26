#!/bin/bash
set -e

# Default environment file
ENV_FILE=".env"

# Allow specifying a different env file
if [ "$1" != "" ]; then
    ENV_FILE="$1"
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file $ENV_FILE not found!"
    echo "Please create it from .env.example"
    exit 1
fi

# Check if NODE_ID is set
if ! grep -q "NODE_ID=" "$ENV_FILE"; then
    echo "Error: NODE_ID must be set in $ENV_FILE"
    exit 1
fi

echo "Using environment file: $ENV_FILE"
echo "Deploying secondary node..."

# Create network if it doesn't exist and isn't external
if grep -q "EXTERNAL_NETWORK=false" "$ENV_FILE"; then
    NETWORK_NAME=$(grep "NETWORK_NAME" "$ENV_FILE" | cut -d '=' -f2)
    NETWORK_NAME=${NETWORK_NAME:-certchain_network}
    
    if ! docker network ls | grep -q "$NETWORK_NAME"; then
        echo "Creating network: $NETWORK_NAME"
        docker network create "$NETWORK_NAME"
    else
        echo "Network $NETWORK_NAME already exists"
    fi
fi

# Deploy the service
docker-compose --env-file "$ENV_FILE" -f docker-compose.secondary.yml up -d --build

# Display URLs
NODE_ID=$(grep "NODE_ID" "$ENV_FILE" | cut -d '=' -f2)
DOMAIN=$(grep "DOMAIN_NAME" "$ENV_FILE" | cut -d '=' -f2)
echo ""
echo "Your node is available at:"
echo "- Node $NODE_ID: https://node$NODE_ID.$DOMAIN"
echo ""
echo "Check logs with:"
echo "docker-compose --env-file $ENV_FILE -f docker-compose.secondary.yml logs -f"
