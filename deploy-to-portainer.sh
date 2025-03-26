#!/bin/bash
# Script to prepare files for Portainer deployment

TARGET_DIR=$1
NODE_TYPE=$2

if [ -z "$TARGET_DIR" ] || [ -z "$NODE_TYPE" ]; then
    echo "Usage: $0 <target_directory> <node_type>"
    echo "Example: $0 /path/to/docker/certchain primary"
    echo "Node types: primary, secondary"
    exit 1
fi

# Create target directories
if [ "$NODE_TYPE" = "primary" ]; then
    mkdir -p "$TARGET_DIR/primary/discovery-service"
    
    # Copy primary node files
    cp Dockerfile "$TARGET_DIR/primary/"
    cp docker-compose.primary.yml "$TARGET_DIR/primary/docker-compose.yml"
    cp .env.example "$TARGET_DIR/primary/.env"
    
    # Copy discovery service files
    cp discovery-service/Dockerfile "$TARGET_DIR/primary/discovery-service/"
    cp discovery-service/package.json "$TARGET_DIR/primary/discovery-service/"
    cp discovery-service/server.js "$TARGET_DIR/primary/discovery-service/"
    
    echo "Primary node files copied to $TARGET_DIR/primary/"
    echo "Don't forget to edit .env file with your specific settings"
    
elif [ "$NODE_TYPE" = "secondary" ]; then
    mkdir -p "$TARGET_DIR/secondary"
    
    # Copy secondary node files
    cp Dockerfile "$TARGET_DIR/secondary/"
    cp docker-compose.secondary.yml "$TARGET_DIR/secondary/docker-compose.yml"
    cp .env.example "$TARGET_DIR/secondary/.env"
    
    echo "Secondary node files copied to $TARGET_DIR/secondary/"
    echo "Don't forget to edit .env file with your specific settings"
    
else
    echo "Invalid node type. Use 'primary' or 'secondary'"
    exit 1
fi

echo "Files prepared for Portainer deployment"
