#!/bin/bash
set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Define package directory
PACKAGE_DIR="certchain-package"
ZIP_NAME="certchain-portainer-stack.zip"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CertChain Portainer Package Creator  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Clean up any existing package directory or zip
if [ -d "$PACKAGE_DIR" ]; then
    echo "Removing existing package directory..."
    rm -rf "$PACKAGE_DIR"
fi

if [ -f "$ZIP_NAME" ]; then
    echo "Removing existing zip file..."
    rm -f "$ZIP_NAME"
fi

# Create package directory structure
mkdir -p "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/config"
mkdir -p "$PACKAGE_DIR/discovery-service"

echo ""
echo -e "${BLUE}Step 1: Node Type Selection${NC}"
echo "Which type of node package do you want to create?"
select node_type in "Primary (node1 + discovery)" "Secondary node"; do
    case $node_type in
        "Primary (node1 + discovery)" ) 
            NODE_TYPE="primary"
            COMPOSE_FILE="docker-compose.primary.yml"
            break;;
        "Secondary node" ) 
            NODE_TYPE="secondary"
            COMPOSE_FILE="docker-compose.secondary.yml"
            break;;
    esac
done

echo ""
echo -e "${BLUE}Step 2: Configuration${NC}"

# Domain configuration
read -p "Enter your domain name (e.g., certchain.example.com): " DOMAIN_NAME

# Node configuration
if [ "$NODE_TYPE" = "primary" ]; then
    NODE_ID=1
else
    read -p "Enter a unique node ID (e.g., 2, 3, etc.): " NODE_ID
fi

# Network configuration
echo "Will this node use an external Traefik network?"
select yn in "Yes" "No"; do
    case $yn in
        Yes ) EXTERNAL_NETWORK=true; break;;
        No ) EXTERNAL_NETWORK=false; break;;
    esac
done

if [ "$EXTERNAL_NETWORK" = true ]; then
    read -p "Enter the name of the Traefik network (default: traefik_network): " NETWORK_NAME
    NETWORK_NAME=${NETWORK_NAME:-traefik_network}
else
    NETWORK_NAME="certchain_network"
fi

# Traefik certresolver configuration
read -p "Enter your Traefik certresolver name (default: le): " CERT_RESOLVER
CERT_RESOLVER=${CERT_RESOLVER:-le}

# Admin API key
ADMIN_API_KEY=$(openssl rand -hex 16)
echo -e "${YELLOW}Generated admin API key: $ADMIN_API_KEY${NC}"
echo "This key will be stored in your .env file."

# Configure discovery service and seed nodes
if [ "$NODE_TYPE" = "secondary" ]; then
    read -p "Enter the discovery service URL (e.g., https://discovery.certchain.example.com): " DISCOVERY_SERVICE
    read -p "Enter comma-separated seed nodes (e.g., https://node1.certchain.example.com): " SEED_NODES
else
    DISCOVERY_SERVICE="https://discovery.$DOMAIN_NAME"
    SEED_NODES=""
fi

# Block interval configuration
read -p "Enter block creation interval in seconds (default: 86400 for daily): " BLOCK_INTERVAL
BLOCK_INTERVAL=${BLOCK_INTERVAL:-86400}

echo ""
echo -e "${BLUE}Step 3: Creating Package Files${NC}"

# Create .env file
cat > "$PACKAGE_DIR/.env" << EOF
# =============================
# CertChain Node Configuration
# =============================

# Domain Configuration
DOMAIN_NAME=$DOMAIN_NAME

# Node Identity
NODE_ID=$NODE_ID
NODE_ENV=production

# Network Configuration
PORT=3000
PUBLIC_URL=https://node$NODE_ID.$DOMAIN_NAME
EXTERNAL_NETWORK=$EXTERNAL_NETWORK
NETWORK_NAME=$NETWORK_NAME

# Discovery Service
DISCOVERY_SERVICE=$DISCOVERY_SERVICE
AUTO_REGISTER=true

# Peer Configuration
SEED_NODES=$SEED_NODES

# Security
ADMIN_API_KEY=$ADMIN_API_KEY

# Blockchain Settings
BLOCK_INTERVAL=$BLOCK_INTERVAL
EOF

echo "Created .env file"

# Copy and customize the docker-compose file
cp "$COMPOSE_FILE" "$PACKAGE_DIR/docker-compose.yml"

# Update certresolver in the docker-compose file if not the default
if [ "$CERT_RESOLVER" != "le" ]; then
    sed -i "s/certresolver=le/certresolver=$CERT_RESOLVER/g" "$PACKAGE_DIR/docker-compose.yml"
    echo "Updated certresolver to '$CERT_RESOLVER' in docker-compose.yml"
fi

# Copy Dockerfile
cp "Dockerfile" "$PACKAGE_DIR/"
echo "Copied Dockerfile"

# Copy discovery service files (for primary node)
if [ "$NODE_TYPE" = "primary" ]; then
    cp "discovery-service/Dockerfile" "$PACKAGE_DIR/discovery-service/"
    cp "discovery-service/package.json" "$PACKAGE_DIR/discovery-service/"
    cp "discovery-service/server.js" "$PACKAGE_DIR/discovery-service/"
    echo "Copied discovery service files"
fi

# Create a README with instructions
cat > "$PACKAGE_DIR/README.md" << EOF
# CertChain Portainer Deployment Package

This package contains all the necessary files to deploy a CertChain ${NODE_TYPE} node using Portainer.

## Deployment Instructions

1. **Log in to your Portainer dashboard**

2. **Create a new stack**
   - Go to "Stacks" → "Add stack"
   - Name your stack (e.g., "certchain-${NODE_TYPE}")

3. **Upload the docker-compose.yml file**
   - Under "Build method" select "Upload" or "Web editor"
   - Upload the docker-compose.yml file or paste its contents

4. **Set environment variables**
   - All environment variables are in the included .env file
   - In Portainer, you can add each variable individually or paste the entire .env content 
     in the "Environment variables" section

5. **Deploy the stack**
   - Click "Deploy the stack"
   - Portainer will build and start the containers

## Configuration Details

- **Domain:** ${DOMAIN_NAME}
- **Node ID:** ${NODE_ID}
- **Admin API Key:** ${ADMIN_API_KEY} (keep this secure)
- **Network:** ${NETWORK_NAME} (${EXTERNAL_NETWORK} external network)
- **Block Interval:** ${BLOCK_INTERVAL} seconds

## Access Your Node

After deployment, your node will be available at:
EOF

# Add the discovery service URL for primary node only
if [ "$NODE_TYPE" = "primary" ]; then
    echo "- Discovery Service: https://discovery.$DOMAIN_NAME" >> "$PACKAGE_DIR/README.md"
fi

# Continue with the README
cat >> "$PACKAGE_DIR/README.md" << EOF
- Node: https://node${NODE_ID}.$DOMAIN_NAME

## API Documentation

Access the API documentation at:
https://node${NODE_ID}.$DOMAIN_NAME/api-docs
EOF

echo "Created README with deployment instructions"

# Create a manifest file
cat > "$PACKAGE_DIR/manifest.json" << EOF
{
  "type": "${NODE_TYPE}",
  "domain": "${DOMAIN_NAME}",
  "nodeId": "${NODE_ID}",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "traefik": {
    "certResolver": "${CERT_RESOLVER}",
    "network": "${NETWORK_NAME}",
    "external": ${EXTERNAL_NETWORK}
  }
}
EOF

echo "Created manifest file"

# Create deployment script for reference
cat > "$PACKAGE_DIR/portainer-deploy.sh" << EOF
#!/bin/bash
# This script is for reference only - deployment should be done through Portainer UI

# 1. Log in to Portainer
# 2. Go to Stacks -> Add stack
# 3. Name: certchain-${NODE_TYPE}
# 4. Upload docker-compose.yml or paste contents in Web editor
# 5. Add environment variables from .env file
# 6. Click "Deploy the stack"

# After deployment, your node will be available at:
EOF

# Add the discovery service URL for primary node only
if [ "$NODE_TYPE" = "primary" ]; then
    echo "# - Discovery Service: https://discovery.$DOMAIN_NAME" >> "$PACKAGE_DIR/portainer-deploy.sh"
fi

# Continue with the deployment script
cat >> "$PACKAGE_DIR/portainer-deploy.sh" << EOF
# - Node: https://node${NODE_ID}.$DOMAIN_NAME
EOF

chmod +x "$PACKAGE_DIR/portainer-deploy.sh"
echo "Created reference deployment script"

# Copy application files
echo "Copying node application files..."

# Copy key application files
cp package.json "$PACKAGE_DIR/"
cp index.js "$PACKAGE_DIR/"
cp -r blockchain "$PACKAGE_DIR/"
cp -r credit "$PACKAGE_DIR/"
cp -r config/config.js "$PACKAGE_DIR/config/"
cp -r services "$PACKAGE_DIR/"
mkdir -p "$PACKAGE_DIR/frontend" && touch "$PACKAGE_DIR/frontend/index.html"

# Create .dockerignore
cp .dockerignore "$PACKAGE_DIR/"

# Create the zip file
echo -e "${BLUE}Step 4: Creating Zip Package${NC}"
zip -r "$ZIP_NAME" "$PACKAGE_DIR" > /dev/null

echo -e "${GREEN}Success! Package created: ${ZIP_NAME}${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Upload this package to your server where Portainer is running"
echo "2. Extract it with: unzip $ZIP_NAME"
echo "3. Follow the instructions in the README.md file to deploy via Portainer"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "- Make sure DNS records are set up for your domains"
echo "- Ensure your Traefik is properly configured"
echo "- Save your admin API key: $ADMIN_API_KEY"

if [ "$NODE_TYPE" = "primary" ]; then
    echo ""
    echo -e "${BLUE}For secondary nodes:${NC}"
    echo "Run this script again and select 'Secondary node' option"
    echo "Use these settings for secondary nodes:"
    echo "- Discovery service: https://discovery.$DOMAIN_NAME"
    echo "- Seed nodes: https://node1.$DOMAIN_NAME"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Package Creation Complete            ${NC}"
echo -e "${BLUE}========================================${NC}"
