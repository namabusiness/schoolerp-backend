# ==========================================
# School ERP Backend Dockerfile (NestJS + Prisma)
# Multi-stage build for minimal production image
# ==========================================

# 1. Builder stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies required by Prisma engine on Alpine Linux
RUN apk add --no-cache openssl libc6-compat

# Copy package manifests and Prisma schema for efficient Docker layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies needed for build)
# Note: npm ci automatically triggers 'prisma generate' via postinstall
RUN npm ci

# Copy full application source code
COPY . .

# Build NestJS application (compiles TypeScript to dist/)
RUN npm run build

# Remove development dependencies to keep the image slim
RUN npm prune --omit=dev

# 2. Production Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime libraries and dumb-init for graceful signal handling (PID 1)
RUN apk add --no-cache openssl libc6-compat dumb-init

ENV NODE_ENV=production
ENV PORT=4000

# Copy production node_modules (with generated Prisma client), build output, and schema
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Use non-root node user for security
USER node

EXPOSE 4000

# Start NestJS backend with dumb-init
CMD ["dumb-init", "node", "dist/src/main.js"]
