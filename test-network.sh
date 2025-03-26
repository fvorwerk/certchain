#!/bin/bash

# Check if we should force a clean restart
FORCE_RESTART=0
if [ "$1" == "--clean" ]; then
  FORCE_RESTART=1
fi

# Stop any running nodes
echo "Stopping any running nodes..."
pkill -f "node index.js"

# Remove existing data if clean restart requested
if [ $FORCE_RESTART -eq 1 ]; then
  echo "Performing clean restart - removing all previous data..."
  rm -rf blocks/node-*  # Remove blockchain data
  rm -rf credit/*.json  # Remove credit ledger data
  rm -rf wallets/*.json # Remove wallet data (if applicable)
  echo "All previous blockchain, credit, and wallet data removed."
fi

# Start 3 nodes on different ports with fast block generation (10 seconds)
echo "Starting node 1 on port 3001..."
NODE_ID=1 PORT=3001 BLOCK_INTERVAL=10 node index.js > node1.log 2>&1 &
NODE1_PID=$!

echo "Starting node 2 on port 3002..."
NODE_ID=2 PORT=3002 BLOCK_INTERVAL=10 node index.js > node2.log 2>&1 &
NODE2_PID=$!

echo "Starting node 3 on port 3003..."
NODE_ID=3 PORT=3003 BLOCK_INTERVAL=10 node index.js > node3.log 2>&1 &
NODE3_PID=$!

echo "All nodes started!"
echo "Wait for nodes to initialize..."
sleep 5  # Increased from 3 to 5 seconds

# Function to check if a node is ready
check_node_ready() {
  local port=$1
  local max_attempts=$2
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    echo "  Checking if node on port $port is ready (attempt $attempt/$max_attempts)..."
    if curl -s -m 1 -H "Accept: application/json" "http://localhost:$port/chain" > /dev/null; then
      echo "  Node on port $port is ready!"
      return 0
    fi
    
    # Check if process is still running
    if ! kill -0 $NODE1_PID 2>/dev/null && [ $port -eq 3001 ]; then
      echo "  ERROR: Node 1 process is not running! Check node1.log for errors."
      return 1
    elif ! kill -0 $NODE2_PID 2>/dev/null && [ $port -eq 3002 ]; then
      echo "  ERROR: Node 2 process is not running! Check node2.log for errors."
      return 1
    elif ! kill -0 $NODE3_PID 2>/dev/null && [ $port -eq 3003 ]; then
      echo "  ERROR: Node 3 process is not running! Check node3.log for errors."
      return 1
    fi
    
    echo "  Node on port $port is not ready yet, waiting..."
    sleep 2
    attempt=$((attempt+1))
  done
  
  echo "  ERROR: Node on port $port did not become ready after $max_attempts attempts."
  return 1
}

echo ""
echo "Checking if nodes are ready..."
check_node_ready 3001 10 || { echo "Failed to start node 1"; exit 1; }
check_node_ready 3002 10 || { echo "Failed to start node 2"; exit 1; }
check_node_ready 3003 10 || { echo "Failed to start node 3"; exit 1; }

echo ""
echo "Now registering the nodes with each other..."

# Register nodes with retries
register_nodes() {
  local port=$1
  local nodes=$2
  local attempts=0
  local max_attempts=5
  
  while [ $attempts -lt $max_attempts ]; do
    echo "  Registering nodes with Node on port $port (attempt $((attempts+1))/$max_attempts)..."
    RESPONSE=$(curl -s -m 5 -X POST -H "Content-Type: application/json" -d "{\"nodes\": $nodes}" "http://localhost:$port/nodes/register")
    
    if [ $? -eq 0 ] && [ ! -z "$RESPONSE" ] && [[ "$RESPONSE" == *"message"* ]]; then
      echo "  Successfully registered nodes with port $port"
      return 0
    fi
    
    echo "  Registration failed, retrying in 2 seconds..."
    sleep 2
    attempts=$((attempts+1))
  done
  
  echo "  ERROR: Failed to register nodes with port $port after $max_attempts attempts."
  return 1
}

# Register node 2 and 3 with node 1
register_nodes 3001 "[\"http://localhost:3002\", \"http://localhost:3003\"]" || echo "Warning: Failed to register nodes with Node 1"

# Register node 1 and 3 with node 2
register_nodes 3002 "[\"http://localhost:3001\", \"http://localhost:3003\"]" || echo "Warning: Failed to register nodes with Node 2"

# Register node 1 and 2 with node 3
register_nodes 3003 "[\"http://localhost:3001\", \"http://localhost:3002\"]" || echo "Warning: Failed to register nodes with Node 3"

echo -e "\nNetwork is set up and running!"
echo "You can test the network with the following commands:"
echo ""
echo "Add a certificate to node 1:"
echo "curl -X POST -H \"Content-Type: application/json\" -d '{\"certificate\":{\"id\":\"cert123\",\"name\":\"Test Certificate\",\"data\":\"Test certificate data\"}}' http://localhost:3001/certificates"
echo ""
echo "Manually mine a block on node 1:"
echo "curl -X POST http://localhost:3001/mine"
echo ""
echo "View the blockchain from any node:"
echo "curl http://localhost:3001/chain"
echo "curl http://localhost:3002/chain"
echo "curl http://localhost:3003/chain"
echo ""
echo "Check consensus between nodes:"
echo "curl http://localhost:3001/nodes/resolve"
echo ""
echo "To stop all nodes:"
echo "pkill -f \"node index.js\""
