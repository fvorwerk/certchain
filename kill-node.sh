#!/bin/bash

# Get node number as argument
NODE_NUM=$1

if [ -z "$NODE_NUM" ] || [[ ! "$NODE_NUM" =~ ^[1-3]$ ]]; then
  echo "Please provide a valid node number (1, 2, or 3)"
  exit 1
fi

PORT=$((3000 + NODE_NUM))

echo "Attempting to kill node $NODE_NUM on port $PORT..."

# Find processes with the specific PORT
pids=$(ps aux | grep "PORT=$PORT" | grep -v grep | awk '{print $2}')

if [ -z "$pids" ]; then
  echo "No processes found for node $NODE_NUM (PORT=$PORT)"
  exit 0
fi

echo "Found process IDs: $pids"

# Kill each process
for pid in $pids; do
  echo "Killing process $pid..."
  kill -9 $pid
done

echo "Done. Checking if node is still responding..."
sleep 1

if curl -s "http://localhost:$PORT/chain" > /dev/null 2>&1; then
  echo "WARNING: Node $NODE_NUM is still running!"
else
  echo "Node $NODE_NUM is successfully stopped."
fi
