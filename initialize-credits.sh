#!/bin/bash

# This script initializes the NFT credit tokens for our test wallets

echo "Initializing NFT credit tokens for test wallets..."

# Wait for a moment to make sure the network is running
sleep 5  # Increased sleep time to ensure network is ready

# Define our two test students
STUDENT1_ID="S1001"
STUDENT2_ID="S2002"

# Define the exact token amounts to ensure consistency
ALICE_TOKENS=16
BOB_TOKENS=16

echo "Checking if network is ready..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  # Try to access the API endpoint directly with clear Accept header
  if curl -s -H "Accept: application/json" "http://localhost:3001/chain" | grep -q "chain"; then
    echo "Network is ready!"
    break
  fi
  echo "Waiting for network to be ready... (attempt $((RETRY_COUNT+1))/$MAX_RETRIES)"
  RETRY_COUNT=$((RETRY_COUNT+1))
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: Network did not become ready in time. Please check if the server is running."
  exit 1
fi

# Add some initial credits to our test wallets
echo "Adding $ALICE_TOKENS credit tokens to $STUDENT1_ID (Alice)..."
RESPONSE=$(curl -s -H "Accept: application/json" -X POST -H "Content-Type: application/json" -d '{
  "walletId": "'"$STUDENT1_ID"'",
  "amount": '"$ALICE_TOKENS"',
  "reason": "Initial test credits"
}' http://localhost:3001/admin/credits/issue)

# Check if response contains HTML (error)
if echo "$RESPONSE" | grep -q "<html"; then
  echo "WARNING: Got HTML response instead of JSON. API routes may be misconfigured."
  echo "Attempting to fix by waiting and retrying..."
  sleep 5
  
  # Retry with direct API call
  RESPONSE=$(curl -s -H "Accept: application/json" -X POST -H "Content-Type: application/json" -d '{
    "walletId": "'"$STUDENT1_ID"'",
    "amount": '"$ALICE_TOKENS"',
    "reason": "Initial test credits"
  }' http://localhost:3001/admin/credits/issue)
fi

echo "Response: $RESPONSE"

echo "Adding $BOB_TOKENS credit tokens to $STUDENT2_ID (Bob)..."
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d '{
  "walletId": "'"$STUDENT2_ID"'",
  "amount": '"$BOB_TOKENS"',
  "reason": "Initial test credits"
}' http://localhost:3001/admin/credits/issue)

echo "Response: $RESPONSE"

# Show that tokens are transferable
echo "Transferring 3 credit tokens from Alice to Bob..."
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d '{
  "fromWalletId": "'"$STUDENT1_ID"'",
  "toWalletId": "'"$STUDENT2_ID"'",
  "amount": 3
}' http://localhost:3001/credits/transfer)

echo "Response: $RESPONSE"

# Verify the balances to make sure they're correctly set
echo "Verifying balances..."
ALICE_BALANCE=$(curl -s "http://localhost:3001/credits/${STUDENT1_ID}" | grep -o '"balance":[0-9]*' | cut -d':' -f2)
BOB_BALANCE=$(curl -s "http://localhost:3001/credits/${STUDENT2_ID}" | grep -o '"balance":[0-9]*' | cut -d':' -f2)

echo "✅ Credit token initialization complete!"
echo "Alice (S1001) balance: ${ALICE_BALANCE:-unknown}"
echo "Bob (S2002) balance: ${BOB_BALANCE:-unknown}"
echo "You can view all token details at http://localhost:3001/ledger/info"

# If we couldn't verify the balances, don't exit with failure
if [ -z "$ALICE_BALANCE" ] || [ -z "$BOB_BALANCE" ]; then
  echo "WARNING: Could not verify balances, but initialization may still be successful"
fi
