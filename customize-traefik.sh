#!/bin/bash
set -e

# Environment file
ENV_FILE=".env"
if [ "$1" != "" ]; then
    ENV_FILE="$1"
fi

# Traefik configuration
CERT_RESOLVER="le"
ENTRYPOINT="websecure"

# Files to update
PRIMARY_COMPOSE="docker-compose.primary.yml"
SECONDARY_COMPOSE="docker-compose.secondary.yml"

echo "Customizing Traefik configuration in docker-compose files..."

# Function to update a docker-compose file
update_compose_file() {
    local file=$1
    local temp_file="${file}.tmp"
    
    # Replace certresolver
    sed "s/certresolver=myresolver/certresolver=${CERT_RESOLVER}/g" "$file" > "$temp_file"
    
    # Replace entrypoints if needed
    sed -i "s/entrypoints=websecure/entrypoints=${ENTRYPOINT}/g" "$temp_file"
    
    # Move temp file back to original
    mv "$temp_file" "$file"
    
    echo "Updated $file with your Traefik configuration"
}

# Update the files
update_compose_file "$PRIMARY_COMPOSE"
update_compose_file "$SECONDARY_COMPOSE"

echo "Configuration complete. You can now deploy with:"
echo "./deploy-primary.sh $ENV_FILE"
