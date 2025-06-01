FROM node:18-alpine AS builder

WORKDIR /app

# Install git for repository cloning
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install git and other necessary tools
RUN apk add --no-cache git curl

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Create necessary directories
RUN mkdir -p /app/logs /app/cache /app/temp && \
    chown -R mcp:nodejs /app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

USER mcp

EXPOSE 3000 9090

CMD ["node", "dist/index.js"]