#!/bin/bash
set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

OUTPUT_DIR="portainer-deploy"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CertChain Portainer Deployment Fix   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create output directory
if [ -d "$OUTPUT_DIR" ]; then
  rm -rf "$OUTPUT_DIR"
fi
mkdir -p "$OUTPUT_DIR"

# Copy .env
if [ -f ".env" ]; then
  cp .env "$OUTPUT_DIR/"
  echo "Copied .env file"
else
  cp .env.example "$OUTPUT_DIR/.env"
  echo "Created .env from example (please edit before deploying)"
fi

# Create flattened discovery service files
mkdir -p "$OUTPUT_DIR/discovery-service"
cp discovery-service/package.json "$OUTPUT_DIR/discovery-service/"
cp discovery-service/server.js "$OUTPUT_DIR/discovery-service/"
cp discovery-service/Dockerfile "$OUTPUT_DIR/discovery-service/"

# Create a modified docker-compose file with volume mounts instead of builds
cat > "$OUTPUT_DIR/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  # Discovery service running on the primary node
  discovery:
    image: node:16-alpine
    restart: always
    working_dir: /app
    command: >
      sh -c "npm install --production && node server.js"
    environment:
      - PORT=4000
    volumes:
      - ./discovery-service:/app
      - discovery_data:/app/data
      - discovery_modules:/app/node_modules
    networks:
      - certchain_network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.discovery.rule=Host(`discovery.${DOMAIN_NAME}`)"
      - "traefik.http.routers.discovery.entrypoints=websecure"
      - "traefik.http.routers.discovery.tls=true"
      - "traefik.http.routers.discovery.tls.certresolver=le"
      - "traefik.http.services.discovery.loadbalancer.server.port=4000"

  # Primary node (node1)
  node1:
    image: node:16-alpine
    restart: always
    working_dir: /app
    command: >
      sh -c "npm install --production && node index.js"
    environment:
      - NODE_ID=1
      - PORT=3000
      - NODE_ENV=production
      - PUBLIC_URL=https://node1.${DOMAIN_NAME}
      - DISCOVERY_SERVICE=https://discovery.${DOMAIN_NAME}
      - AUTO_REGISTER=true
      - ADMIN_API_KEY=${ADMIN_API_KEY:-admin_key_secure_1}
      - BLOCK_INTERVAL=${BLOCK_INTERVAL:-86400}
    volumes:
      - ./:/app
      - node1_data:/app/blocks
      - node1_config:/app/config
      - node_modules:/app/node_modules
    networks:
      - certchain_network
    depends_on:
      - discovery
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.node1.rule=Host(`node1.${DOMAIN_NAME}`)"
      - "traefik.http.routers.node1.entrypoints=websecure"
      - "traefik.http.routers.node1.tls=true"
      - "traefik.http.routers.node1.tls.certresolver=le"
      - "traefik.http.services.node1.loadbalancer.server.port=3000"

networks:
  certchain_network:
    external: ${EXTERNAL_NETWORK:-false}
    name: ${NETWORK_NAME:-certchain_network}

volumes:
  discovery_data:
  discovery_modules:
  node1_data:
  node1_config:
  node_modules:
EOF

# Copy main Dockerfile and application files
cp Dockerfile "$OUTPUT_DIR/"
cp package.json "$OUTPUT_DIR/"
cp index.js "$OUTPUT_DIR/"

# Create necessary directories and copy files
mkdir -p "$OUTPUT_DIR/blockchain"
cp -r blockchain/* "$OUTPUT_DIR/blockchain/"

mkdir -p "$OUTPUT_DIR/credit"
cp -r credit/* "$OUTPUT_DIR/credit/"

mkdir -p "$OUTPUT_DIR/config"
cp config/config.js "$OUTPUT_DIR/config/"

mkdir -p "$OUTPUT_DIR/services"
cp services/discovery.js "$OUTPUT_DIR/services/"

mkdir -p "$OUTPUT_DIR/frontend"
touch "$OUTPUT_DIR/frontend/index.html"

# Create .dockerignore
cp .dockerignore "$OUTPUT_DIR/"

echo -e "${GREEN}Success! Deployment package created in: ${OUTPUT_DIR}${NC}"
echo ""
echo -e "${BLUE}Instructions:${NC}"
echo "1. Edit the .env file in the ${OUTPUT_DIR} directory"
echo "2. Zip the entire directory: zip -r portainer-deploy.zip ${OUTPUT_DIR}"
echo "3. Upload the zip to your server"
echo "4. Extract: unzip portainer-deploy.zip"
echo "5. In Portainer, deploy a new stack using '${OUTPUT_DIR}/docker-compose.yml'"

echo ""
echo -e "${YELLOW}Important:${NC}"
echo "Portainer needs all files in their correct relative locations. This script"
echo "creates a flattened directory structure that works with Portainer's deployment."
echo -e "${BLUE}========================================${NC}"
