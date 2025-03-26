#!/bin/bash
set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ENV_FILE=".env"
PRIMARY_COMPOSE="docker-compose.primary.yml"
SECONDARY_COMPOSE="docker-compose.secondary.yml"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CertChain Production Setup Wizard    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    echo "Visit https://docs.docker.com/get-docker/ for installation instructions."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Docker Compose not found. Checking if Docker Compose plugin is available...${NC}"
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
        echo "Visit https://docs.docker.com/compose/install/ for installation instructions."
        exit 1
    else
        echo -e "${GREEN}Docker Compose plugin is available.${NC}"
        COMPOSE_COMMAND="docker compose"
    fi
else
    COMPOSE_COMMAND="docker-compose"
    echo -e "${GREEN}Docker Compose is installed.${NC}"
fi

echo ""
echo -e "${BLUE}Step 1: Node Type Selection${NC}"
echo "Is this the primary node (with discovery service)?"
select yn in "Yes" "No"; do
    case $yn in
        Yes ) NODE_TYPE="primary"; break;;
        No ) NODE_TYPE="secondary"; break;;
    esac
done

echo ""
echo -e "${BLUE}Step 2: Environment Configuration${NC}"

# Create .env file
if [ -f "$ENV_FILE" ]; then
    echo "An existing $ENV_FILE file was found."
    echo "Would you like to use this file or create a new one?"
    select choice in "Use existing" "Create new"; do
        case $choice in
            "Use existing" ) ENV_EXISTS=true; break;;
            "Create new" ) ENV_EXISTS=false; break;;
        esac
    done
else
    ENV_EXISTS=false
fi

if [ "$ENV_EXISTS" = false ]; then
    echo "Creating a new environment file..."
    
    # Domain configuration
    read -p "Enter your domain name (e.g., certchain.example.com): " DOMAIN_NAME
    
    # Node configuration
    if [ "$NODE_TYPE" = "primary" ]; then
        NODE_ID=1
    else
        read -p "Enter a unique node ID (e.g., 2, 3, etc.): " NODE_ID
    fi
    
    # Network configuration
    echo "Is this node using an external Traefik network?"
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
    
    # Generate a secure random API key
    ADMIN_API_KEY=$(openssl rand -hex 16)
    
    # Configure discovery service and seed nodes
    if [ "$NODE_TYPE" = "secondary" ]; then
        read -p "Enter the discovery service URL (e.g., https://discovery.certchain.example.com): " DISCOVERY_SERVICE
        read -p "Enter comma-separated seed nodes (e.g., https://node1.certchain.example.com): " SEED_NODES
    else
        DISCOVERY_SERVICE="https://discovery.$DOMAIN_NAME"
        SEED_NODES=""
    fi
    
    # Write to .env file
    cat > "$ENV_FILE" << EOF
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
BLOCK_INTERVAL=86400
EOF

    echo -e "${GREEN}Environment file created successfully.${NC}"
    echo -e "${YELLOW}Your admin API key is: $ADMIN_API_KEY${NC}"
    echo "Please save this key in a secure location."
fi

echo ""
echo -e "${BLUE}Step 3: Traefik Integration${NC}"
echo "Does your existing Traefik use 'le' as the certresolver name?"
select yn in "Yes" "No" "Not using Traefik"; do
    case $yn in
        Yes ) break;;
        No ) 
            read -p "Enter your Traefik certresolver name: " CERT_RESOLVER
            sed -i "s/certresolver=le/certresolver=$CERT_RESOLVER/g" $PRIMARY_COMPOSE
            sed -i "s/certresolver=le/certresolver=$CERT_RESOLVER/g" $SECONDARY_COMPOSE
            break;;
        "Not using Traefik" ) break;;
    esac
done

echo ""
echo -e "${BLUE}Step 4: Deployment${NC}"
echo "Ready to deploy your $NODE_TYPE node."
echo "This will:"
if [ "$NODE_TYPE" = "primary" ]; then
    echo "  - Start the primary CertChain node"
    echo "  - Start the discovery service"
else
    echo "  - Start a secondary CertChain node"
fi
echo "  - Configure it to work with your domain: $DOMAIN_NAME"

read -p "Continue with deployment? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting deployment..."
    
    # Make deployment scripts executable
    chmod +x deploy-primary.sh
    chmod +x deploy-secondary.sh
    
    if [ "$NODE_TYPE" = "primary" ]; then
        ./deploy-primary.sh "$ENV_FILE"
    else
        ./deploy-secondary.sh "$ENV_FILE"
    fi
    
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    
    # Display URLs
    if [ "$NODE_TYPE" = "primary" ]; then
        echo ""
        echo "Your services are available at:"
        echo "  - Discovery service: https://discovery.$DOMAIN_NAME"
        echo "  - Primary node: https://node1.$DOMAIN_NAME"
        echo ""
        echo "API documentation: https://node1.$DOMAIN_NAME/api-docs"
    else
        echo ""
        echo "Your node is available at:"
        echo "  - Node $NODE_ID: https://node$NODE_ID.$DOMAIN_NAME"
        echo ""
        echo "API documentation: https://node$NODE_ID.$DOMAIN_NAME/api-docs"
    fi
    
    echo ""
    echo -e "${BLUE}Post-Deployment Steps:${NC}"
    echo "1. Ensure your DNS records are set up for your domains"
    echo "2. Check that Traefik is properly routing traffic to your containers"
    echo "3. Verify that the nodes are running: docker ps"
    echo "4. Check logs with: docker logs [container_name]"
    
    # For primary node, show how to register secondary nodes
    if [ "$NODE_TYPE" = "primary" ]; then
        echo ""
        echo -e "${YELLOW}To deploy secondary nodes:${NC}"
        echo "1. Copy this project to another server"
        echo "2. Run this script and select 'No' for primary node question"
        echo "3. Use these settings:"
        echo "   - Discovery service: https://discovery.$DOMAIN_NAME"
        echo "   - Seed nodes: https://node1.$DOMAIN_NAME"
    fi
else
    echo "Deployment cancelled."
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CertChain Setup Wizard Completed     ${NC}"
echo -e "${BLUE}========================================${NC}"
