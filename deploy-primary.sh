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

echo "Using environment file: $ENV_FILE"
echo "Deploying primary node + discovery service..."

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

# Deploy the services
docker-compose --env-file "$ENV_FILE" -f docker-compose.primary.yml up -d --build

echo "Deployment completed. Check logs with:"
echo "docker-compose --env-file $ENV_FILE -f docker-compose.primary.yml logs -f"

# Display URLs
DOMAIN=$(grep "DOMAIN_NAME" "$ENV_FILE" | cut -d '=' -f2)
echo ""
echo "Your services are available at:"
echo "- Discovery Service: https://discovery.$DOMAIN"
echo "- Primary Node: https://node1.$DOMAIN"
