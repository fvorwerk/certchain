FROM node:16-alpine

# Install dependencies for native builds (if needed)
RUN apk add --no-cache python3 make g++ 

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with production flag and clear npm cache
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p config blocks

# Remove development dependencies and files
RUN rm -rf tests/ .git* docs/

# Expose port
EXPOSE 3000

# Run as non-root user for security
RUN addgroup -g 1000 certchain && \
    adduser -u 1000 -G certchain -s /bin/sh -D certchain && \
    chown -R certchain:certchain /app

USER certchain

# Set health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q -O- http://localhost:3000/health || exit 1

# Start command
CMD ["node", "index.js"]
