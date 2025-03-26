#!/bin/bash
set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get container ID
CONTAINER_ID=$(docker ps -qf "name=certchain_node1")

if [ -z "$CONTAINER_ID" ]; then
    echo -e "${RED}Node container not found!${NC}"
    echo "Checking for any certchain containers..."
    CONTAINERS=$(docker ps -af "name=certchain" --format "{{.Names}}: {{.Status}}")
    
    if [ -z "$CONTAINERS" ]; then
        echo -e "${RED}No certchain containers found.${NC}"
    else
        echo -e "${YELLOW}Found these containers:${NC}"
        echo "$CONTAINERS"
    fi
    exit 1
fi

echo -e "${BLUE}=== Node Container Information ===${NC}"
echo -e "${YELLOW}Container ID:${NC} $CONTAINER_ID"

echo -e "\n${BLUE}=== Container Logs ===${NC}"
docker logs --tail 50 $CONTAINER_ID

echo -e "\n${BLUE}=== Directory Structure ===${NC}"
docker exec $CONTAINER_ID sh -c "ls -la /app"

echo -e "\n${BLUE}=== Node Modules ===${NC}"
docker exec $CONTAINER_ID sh -c "ls -la /app/node_modules || echo 'No node_modules directory'"

echo -e "\n${BLUE}=== Config Files ===${NC}"
docker exec $CONTAINER_ID sh -c "ls -la /app/config || echo 'No config directory'"

echo -e "\n${BLUE}=== Package.json ===${NC}"
docker exec $CONTAINER_ID sh -c "cat /app/package.json || echo 'No package.json file'"

echo -e "\n${BLUE}=== Interactive Debug ===${NC}"
echo -e "${YELLOW}Opening shell in container. Type 'exit' to leave.${NC}"
docker exec -it $CONTAINER_ID sh
