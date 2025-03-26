#!/bin/bash

# This is a more aggressive node killing script that uses multiple detection methods

# Get node number as argument
NODE_NUM=$1

if [ -z "$NODE_NUM" ] || [[ ! "$NODE_NUM" =~ ^[1-3]$ ]]; then
  echo "Please provide a valid node number (1, 2, or 3)"
  exit 1
fi

PORT=$((3000 + NODE_NUM))
TIMEOUT_DURATION=3  # Timeout in seconds for commands

echo "=== FORCEFULLY TERMINATING NODE $NODE_NUM (PORT $PORT) ==="
echo "Using multiple detection methods..."

# Method 1: Find processes listening on the specific port
echo -e "\n1. Looking for processes on port $PORT:"
timeout $TIMEOUT_DURATION lsof -i :$PORT || echo "No process found by port (lsof)"
timeout $TIMEOUT_DURATION netstat -nlp 2>/dev/null | grep :$PORT || echo "No process found by port (netstat)"

# Method 2: Find node processes with the PORT environment variable
echo -e "\n2. Looking for Node.js processes with PORT=$PORT:"
timeout $TIMEOUT_DURATION ps aux | grep "PORT=$PORT" | grep -v grep

# Method 3: Try to find any node process that might be our target
echo -e "\n3. All running Node.js processes:"
timeout $TIMEOUT_DURATION ps aux | grep "node.*index.js" | grep -v grep

# First attempt: Kill by PORT pattern
echo -e "\n4. Attempting to kill process with PORT=$PORT pattern..."
timeout $TIMEOUT_DURATION pkill -9 -f "PORT=$PORT" && echo "Process killed by PORT pattern" || echo "No process killed by PORT pattern"
sleep 0.3  # Short wait to allow process to terminate

# Second attempt: Kill any process listening on that port
echo -e "\n5. Attempting to kill any process on port $PORT..."
PID=$(timeout $TIMEOUT_DURATION lsof -t -i:$PORT 2>/dev/null)
if [ ! -z "$PID" ]; then
  echo "Found PID $PID listening on port $PORT, killing..."
  kill -9 $PID
  echo "Process killed"
  sleep 0.3  # Short wait to allow process to terminate
else
  echo "No process found listening on port $PORT"
fi

# Third attempt: Kill by a broader pattern match
echo -e "\n6. Attempting broader pattern match..."
timeout $TIMEOUT_DURATION pkill -9 -f "node.*index.*PORT" && echo "Process killed by broader pattern" || echo "No process killed by broader pattern"
sleep 0.3  # Short wait to allow process to terminate

# Final check
echo -e "\nFinal check to see if anything is still running on port $PORT..."
if timeout 2 curl -s "http://localhost:$PORT/chain" > /dev/null 2>&1; then
  echo "WARNING: Node $NODE_NUM is STILL running on port $PORT!"
  echo -e "\nFor manual killing, use one of these commands with the appropriate PID:"
  echo "  kill -9 PID"
  echo "  sudo kill -9 PID"
  echo -e "\nTo find PIDs, run: ps aux | grep node"
else
  echo "Success! Node $NODE_NUM is no longer responding on port $PORT."
fi

echo -e "\nDone."
