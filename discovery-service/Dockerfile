FROM node:16-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with production flag
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p data

# Remove unnecessary files
RUN rm -rf .git*

# Run as non-root user for security
RUN addgroup -g 1000 discovery && \
    adduser -u 1000 -G discovery -s /bin/sh -D discovery && \
    chown -R discovery:discovery /app

USER discovery

# Expose port
EXPOSE 4000

# Set health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q -O- http://localhost:4000/health || exit 1

# Start command
CMD ["node", "server.js"]
