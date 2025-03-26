#!/bin/bash

# This script runs the entire setup process in the correct order:
# 1. Start the blockchain network (test-network.sh)
# 2. Initialize credit tokens (initialize-credits.sh)
# 3. Create test certificates (setup-test-wallets.sh)

echo "========================================="
echo "CertChain Full System Setup"
echo "========================================="

echo -e "\n[PHASE 1] Starting blockchain network..."
# Add a log option to help diagnose future problems
./test-network.sh --clean 2>&1 | tee setup_network.log
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "ERROR: Failed to start blockchain network. Check setup_network.log for details."
  exit 1
fi

echo -e "\n[PHASE 2] Initializing credit tokens..."
# Check that nodes are still running before proceeding
if ! curl -s --max-time 2 "http://localhost:3001/chain" > /dev/null; then
  echo "ERROR: Node 1 is not responding. Please check node1.log"
  exit 1
fi

# Add a log option to help diagnose future problems 
./initialize-credits.sh 2>&1 | tee setup_credits.log
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "ERROR: Failed to initialize credit tokens. Check setup_credits.log for details."
  exit 1
fi

echo -e "\n[PHASE 3] Creating test certificates..."
# Add a log option to help diagnose future problems
./setup-test-wallets.sh 2>&1 | tee setup_wallets.log
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "ERROR: Failed to create test certificates. Check setup_wallets.log for details."
  echo "Note: The system may still be usable if some certificates were created."
fi

echo -e "\n========================================="
echo "CertChain system setup complete!"
echo "========================================="
echo ""
echo "You can now access the system at:"
echo "- Blockchain Explorer: http://localhost:3001/"
echo "- Certificate Wallet: http://localhost:3001/wallet.html"
echo "- Bank Administration: http://localhost:3001/bank-admin.html"
echo ""
echo "Test accounts:"
echo "- Alice: S1001 (Credits: ~17)"
echo "- Bob: S2002 (Credits: ~18)"
echo ""
echo "If you encounter any issues, check these log files:"
echo "- node1.log, node2.log, node3.log: Node-specific logs"
echo "- setup_network.log: Network setup logs"
echo "- setup_credits.log: Credit initialization logs"
echo "- setup_wallets.log: Wallet/certificate setup logs"
