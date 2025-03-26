#!/bin/bash
set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default files
ENV_FILE=".env"
OUTPUT_FILE="docker-compose.combined.yml"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CertChain Compose File Combiner      ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for environment file
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}No .env file found. You can specify one or continue without it.${NC}"
    read -p "Enter path to env file (or press Enter to continue): " custom_env
    if [ ! -z "$custom_env" ] && [ -f "$custom_env" ]; then
        ENV_FILE="$custom_env"
    elif [ ! -z "$custom_env" ]; then
        echo -e "${RED}File not found: $custom_env${NC}"
        exit 1
    fi
fi

# Get deployment type
echo -e "${BLUE}What type of docker-compose file do you want to create?${NC}"
select compose_type in "Primary node only" "Secondary node only" "All nodes (primary + secondary)"; do
    case $compose_type in
        "Primary node only" )
            INPUT_FILE="docker-compose.primary.yml"
            echo "Creating combined file for primary node setup..."
            break;;
        "Secondary node only" )
            INPUT_FILE="docker-compose.secondary.yml"
            echo "Creating combined file for secondary node setup..."
            break;;
        "All nodes (primary + secondary)" )
            echo "Creating combined file with all nodes..."
            MULTI_NODE=true
            break;;
    esac
done

# Load environment variables from .env file if it exists
if [ -f "$ENV_FILE" ]; then
    echo "Loading environment variables from $ENV_FILE"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "No environment file used. You'll need to manually specify values."
fi

# If some key variables aren't set, ask for them
if [ -z "$DOMAIN_NAME" ]; then
    read -p "Enter domain name: " DOMAIN_NAME
    export DOMAIN_NAME
fi

if [ -z "$NETWORK_NAME" ]; then
    read -p "Enter network name (default: certchain_network): " NETWORK_NAME
    NETWORK_NAME=${NETWORK_NAME:-certchain_network}
    export NETWORK_NAME
fi

if [ -z "$EXTERNAL_NETWORK" ]; then
    echo "Is this an external network?"
    select yn in "Yes" "No"; do
        case $yn in
            Yes ) EXTERNAL_NETWORK=true; break;;
            No ) EXTERNAL_NETWORK=false; break;;
        esac
    done
    export EXTERNAL_NETWORK
fi

if [ -z "$ADMIN_API_KEY" ]; then
    ADMIN_API_KEY=$(openssl rand -hex 16)
    echo -e "${YELLOW}Generated API key: $ADMIN_API_KEY${NC}"
    export ADMIN_API_KEY
fi

if [ -z "$BLOCK_INTERVAL" ]; then
    read -p "Enter block creation interval in seconds (default: 86400 for daily): " BLOCK_INTERVAL
    BLOCK_INTERVAL=${BLOCK_INTERVAL:-86400}
    export BLOCK_INTERVAL
fi

# For multi-node setup, need to set NODE_IDs
if [ "$MULTI_NODE" = true ]; then
    echo -e "${BLUE}Creating a multi-node configuration${NC}"
    # For primary node these are fixed
    export NODE_ID=1
    export PUBLIC_URL=https://node1.$DOMAIN_NAME
    export DISCOVERY_SERVICE=https://discovery.$DOMAIN_NAME
    export AUTO_REGISTER=true
    export SEED_NODES=""
    
    # Ask for secondary node configuration
    read -p "How many secondary nodes to include? (default: 2): " SEC_NODE_COUNT
    SEC_NODE_COUNT=${SEC_NODE_COUNT:-2}
    
    # Secondary nodes environment
    for i in $(seq 2 $((SEC_NODE_COUNT + 1))); do
        export SEC_NODE_${i}_ID=$i
        export SEC_NODE_${i}_PUBLIC_URL=https://node$i.$DOMAIN_NAME
        export SEC_NODE_${i}_ADMIN_API_KEY=$(openssl rand -hex 8)
        export SEC_NODE_${i}_SEED_NODES=https://node1.$DOMAIN_NAME
    done
fi

# Process compose file based on the selection
if [ "$MULTI_NODE" = true ]; then
    # Create a custom multi-node compose file
    echo "version: '3.8'" > "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "services:" >> "$OUTPUT_FILE"
    
    # Add discovery service
    sed -n '/discovery:/,/node1:/p' docker-compose.primary.yml | sed '$d' | \
        envsubst '${DOMAIN_NAME},${PORT},${NETWORK_NAME}' >> "$OUTPUT_FILE"
    
    # Add primary node (node1)
    sed -n '/node1:/,/networks:/p' docker-compose.primary.yml | sed '$d' | \
        envsubst '${DOMAIN_NAME},${NODE_ID},${PUBLIC_URL},${DISCOVERY_SERVICE},${AUTO_REGISTER},${ADMIN_API_KEY},${BLOCK_INTERVAL}' >> "$OUTPUT_FILE"
    
    # Add secondary nodes
    for i in $(seq 2 $((SEC_NODE_COUNT + 1))); do
        echo "  node$i:" >> "$OUTPUT_FILE"
        CURRENT_ID="SEC_NODE_${i}_ID"
        CURRENT_URL="SEC_NODE_${i}_PUBLIC_URL"
        CURRENT_KEY="SEC_NODE_${i}_ADMIN_API_KEY"
        CURRENT_SEEDS="SEC_NODE_${i}_SEED_NODES"
        
        sed -n '/build:/,/labels:/p' docker-compose.secondary.yml | sed '$d' | \
            sed "s/\${NODE_ID}/${!CURRENT_ID}/g" | \
            sed "s#\${PUBLIC_URL}#${!CURRENT_URL}#g" | \
            sed "s#\${DISCOVERY_SERVICE}#$DISCOVERY_SERVICE#g" | \
            sed "s/\${ADMIN_API_KEY}/${!CURRENT_KEY}/g" | \
            sed "s#\${SEED_NODES}#${!CURRENT_SEEDS}#g" | \
            sed "s/\${BLOCK_INTERVAL}/$BLOCK_INTERVAL/g" >> "$OUTPUT_FILE"
        
        echo "    labels:" >> "$OUTPUT_FILE"
        sed -n '/traefik.enable/,/loaders:/p' docker-compose.secondary.yml | sed '$d' | \
            sed "s/\${NODE_ID}/${!CURRENT_ID}/g" | \
            sed "s/\${DOMAIN_NAME}/$DOMAIN_NAME/g" >> "$OUTPUT_FILE"
    done
    
    # Add networks section
    echo "networks:" >> "$OUTPUT_FILE"
    echo "  certchain_network:" >> "$OUTPUT_FILE"
    echo "    external: $EXTERNAL_NETWORK" >> "$OUTPUT_FILE"
    echo "    name: $NETWORK_NAME" >> "$OUTPUT_FILE"
    
    # Add volumes section
    echo "" >> "$OUTPUT_FILE"
    echo "volumes:" >> "$OUTPUT_FILE"
    echo "  discovery_data:" >> "$OUTPUT_FILE"
    echo "  node1_data:" >> "$OUTPUT_FILE"
    echo "  node1_config:" >> "$OUTPUT_FILE"
    
    for i in $(seq 2 $((SEC_NODE_COUNT + 1))); do
        echo "  node${i}_data:" >> "$OUTPUT_FILE"
        echo "  node${i}_config:" >> "$OUTPUT_FILE"
    done
    
else
    # Process a single compose file with environment variable expansion
    TEMP_FILE=$(mktemp)
    
    if [ -f "$INPUT_FILE" ]; then
        # Use envsubst to replace all environment variables
        cat $INPUT_FILE > $TEMP_FILE
        
        # Replace known variables
        envsubst < $TEMP_FILE > $OUTPUT_FILE
    else
        echo -e "${RED}Input file $INPUT_FILE not found!${NC}"
        exit 1
    fi
    
    # Cleanup temp file
    rm $TEMP_FILE
fi

echo -e "${GREEN}Successfully created $OUTPUT_FILE${NC}"
echo ""
echo -e "${BLUE}This file contains all environment variables expanded and can be${NC}"
echo -e "${BLUE}directly used with docker-compose or uploaded to Portainer.${NC}"
echo ""

# Document the configuration
echo -e "${YELLOW}Configuration summary:${NC}"
echo "- Domain: $DOMAIN_NAME"
echo "- Network: $NETWORK_NAME (external: $EXTERNAL_NETWORK)"
echo "- Block interval: $BLOCK_INTERVAL seconds"

if [ "$MULTI_NODE" = true ]; then
    echo "- Primary node API key: $ADMIN_API_KEY"
    for i in $(seq 2 $((SEC_NODE_COUNT + 1))); do
        CURRENT_KEY="SEC_NODE_${i}_ADMIN_API_KEY"
        echo "- Node $i API key: ${!CURRENT_KEY}"
    done
else
    echo "- API key: $ADMIN_API_KEY"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}         Operation Complete             ${NC}"
echo -e "${BLUE}========================================${NC}"
