#!/bin/bash

# Script to restart a single blockchain node and reconnect it to the network

# Get node number as argument
NODE_NUM=$1

if [ -z "$NODE_NUM" ] || [[ ! "$NODE_NUM" =~ ^[1-3]$ ]]; then
  echo "Please provide a valid node number (1, 2, or 3)"
  echo "Usage: ./restart-node.sh NODE_NUM"
  exit 1
fi

PORT=$((3000 + NODE_NUM))

echo "===== RESTARTING NODE $NODE_NUM (PORT $PORT) ====="

# Step 1: Stop the node
echo "Step 1: Stopping node $NODE_NUM..."
./force-kill-node.sh $NODE_NUM
# Give it a moment to fully stop
sleep 2

# Step 2: Verify the node is stopped with timeout
echo "Step 2: Verifying node is stopped..."
if curl -s --max-time 3 "http://localhost:$PORT/chain" > /dev/null 2>&1; then
  echo "ERROR: Node $NODE_NUM is still running. Please stop it manually before restarting."
  exit 1
else
  echo "Confirmed: Node $NODE_NUM is stopped"
fi

# Step 3: Start the node
echo "Step 3: Starting node $NODE_NUM..."
NODE_ID=$NODE_NUM PORT=$PORT BLOCK_INTERVAL=10 node index.js > node$NODE_NUM.log 2>&1 &
NODE_PID=$!
echo "Node $NODE_NUM started with PID $NODE_PID"

# Step 4: Wait for node to fully start
echo "Step 4: Waiting for node to initialize..."
sleep 3

# Step 5: Verify the node is running with timeout
echo "Step 5: Verifying node is running (timeout: 10s)..."
MAX_RETRIES=5
RETRY_COUNT=0
NODE_RUNNING=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s --max-time 2 "http://localhost:$PORT/chain" > /dev/null 2>&1; then
    NODE_RUNNING=true
    break
  fi
  echo "  Waiting for node to respond... (attempt $((RETRY_COUNT+1))/$MAX_RETRIES)"
  RETRY_COUNT=$((RETRY_COUNT+1))
  sleep 2
done

if [ "$NODE_RUNNING" = false ]; then
  echo "ERROR: Node $NODE_NUM failed to start within timeout. Check the logs: cat node$NODE_NUM.log"
  exit 1
fi

echo "Node $NODE_NUM is running successfully"

# Step 6: Wait and verify node stability
echo "Step 6: Waiting 5 seconds to verify node stability..."
sleep 5

# Verify the node is still running
if ! curl -s --max-time 2 "http://localhost:$PORT/chain" > /dev/null 2>&1; then
  echo "ERROR: Node $NODE_NUM crashed after initial startup. Check the logs: cat node$NODE_NUM.log"
  exit 1
fi
echo "Node $NODE_NUM remains stable after 5 seconds"

# Step 7: Re-register this node with the network
echo "Step 7: Re-registering with the network..."

# Define other nodes
OTHER_NODES=()
for i in {1..3}; do
  if [ $i -ne $NODE_NUM ]; then
    OTHER_NODES+=("http://localhost:$((3000 + i))")
  fi
done

# Register this node with all other nodes
for other_node in "${OTHER_NODES[@]}"; do
  echo "  Registering with $other_node..."
  curl -s --max-time 5 -X POST -H "Content-Type: application/json" \
       -d "{\"nodes\": [\"http://localhost:$PORT\"]}" \
       "$other_node/nodes/register" > /dev/null
done

# Step 8: Register all other nodes with this node
echo "Step 8: Registering other nodes with this node..."
JSON_NODES=$(printf '"%s",' "${OTHER_NODES[@]}" | sed 's/,$//')
JSON_PAYLOAD="{\"nodes\": [$JSON_NODES]}"

curl -s --max-time 5 -X POST -H "Content-Type: application/json" \
     -d "$JSON_PAYLOAD" \
     "http://localhost:$PORT/nodes/register" > /dev/null

echo "  Registered nodes: ${OTHER_NODES[*]}"

# Step 9: Run consensus to sync with the network (with timeout)
echo "Step 9: Running consensus to sync with the network (timeout: 10s)..."
CONSENSUS_RESULT=$(curl -s --max-time 10 "http://localhost:$PORT/nodes/resolve")
if [ -z "$CONSENSUS_RESULT" ]; then
  echo "  WARNING: Consensus request timed out after 10 seconds"
  echo "  Node may still be syncing - check logs for details"
else
  echo "  Consensus result: $CONSENSUS_RESULT"
fi

echo "===== RESTART PROCESS COMPLETE ====="
echo "Node $NODE_NUM is now running on port $PORT and connected to the network"
echo "You can monitor the logs with: tail -f node$NODE_NUM.log"
