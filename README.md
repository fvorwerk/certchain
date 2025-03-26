# CertChain - Blockchain Certificate System

A blockchain-based system for issuing and verifying certificates with an integrated token economy.

## Table of Contents
- [Quick Deployment Guide](#quick-deployment-guide)
  - [Option 1: Deploy using Git](#option-1-deploy-using-git)
  - [Option 2: Deploy with Portainer](#option-2-deploy-with-portainer)
- [Required Environment Variables](#required-environment-variables)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)

## Quick Deployment Guide

### Option 1: Deploy using Git

1. **Clone this repository on your server**
   ```bash
   git clone https://github.com/yourusername/certchain.git
   cd certchain
   ```

2. **Choose your deployment type**
   - For primary node (with discovery service): Use `docker-compose.primary.yml`
   - For secondary node: Use `docker-compose.secondary.yml`

3. **Create your environment file**
   ```bash
   cp .env.example .env
   # Edit the .env file with your configuration
   nano .env
   ```

4. **Deploy with Docker Compose**
   ```bash
   # For primary node:
   docker-compose -f docker-compose.primary.yml up -d
   
   # For secondary node:
   docker-compose -f docker-compose.secondary.yml up -d
   ```

### Option 2: Deploy with Portainer

1. **In Portainer, go to Stacks → Add stack**

2. **For Repository deployment:**
   - Select "Git repository"
   - Repository URL: `https://github.com/yourusername/certchain.git`
   - Reference: `main` (or your preferred branch)
   - Compose path: 
     - Primary node: `docker-compose.primary.yml`
     - Secondary node: `docker-compose.secondary.yml`

3. **Add environment variables**
   - Copy variables from `.env.example` and set appropriate values

4. **Deploy the stack**

## Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| DOMAIN_NAME | Base domain for all nodes | `certchain.example.com` |
| NODE_ID | Unique ID for this node | `1` (primary) or `2+` (secondary) |
| EXTERNAL_NETWORK | Using external network | `true` or `false` |
| NETWORK_NAME | Docker network name | `traefik_network` |
| ADMIN_API_KEY | Security key for admin APIs | `generate-secure-random-key` |
| DISCOVERY_SERVICE | URL to discovery service | `https://discovery.certchain.example.com` |
| SEED_NODES | Initial peers (secondary only) | `https://node1.certchain.example.com` |

## Project Structure

The repository contains these key files:

## Configuration

See the [.env.example](.env.example) file for all available configuration options.

## API Documentation

API documentation is available at `/api-docs` on any running node.
