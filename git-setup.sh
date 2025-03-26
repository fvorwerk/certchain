#!/bin/bash

# Color formatting
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Setting up Git repository for CertChain..."

# Check if we have any commits yet
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
    echo -e "${YELLOW}No commits found. Creating initial commit...${NC}"
    
    # Initialize git if needed
    if [ ! -d .git ]; then
        git init
        echo "Git repository initialized."
    fi
    
    # Add all files
    git add .
    
    # Create initial commit
    git commit -m "Initial commit"
    echo -e "${GREEN}Initial commit created.${NC}"
else
    echo "Repository already has commits."
fi

# Check which branch we're on
current_branch=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $current_branch"

if [ "$current_branch" != "main" ]; then
    echo -e "${YELLOW}Current branch is '$current_branch', not 'main'. Renaming...${NC}"
    git branch -m $current_branch main
    echo -e "${GREEN}Branch renamed to 'main'.${NC}"
fi

# Verify remote
if git remote get-url origin >/dev/null 2>&1; then
    echo "Remote 'origin' already exists. Updating URL..."
    git remote set-url origin https://github.com/fvorwerk/certchain.git
else
    echo "Adding remote 'origin'..."
    git remote add origin https://github.com/fvorwerk/certchain.git
fi

echo -e "${GREEN}Remote 'origin' set to https://github.com/fvorwerk/certchain.git${NC}"

# Push to GitHub
echo "Pushing to GitHub..."
git push -u origin main

echo -e "${GREEN}Setup complete!${NC}"
echo "Your code should now be on GitHub at: https://github.com/fvorwerk/certchain"
