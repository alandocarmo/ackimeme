# Stage 1: Build TypeScript source code
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy shared-types from repo root
COPY shared-types ./shared-types

# Copy backend package files
COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm ci

# Copy backend source
COPY backend ./
RUN npm run build

# Stage 2: Production environment
FROM node:20-bookworm-slim

WORKDIR /app

COPY shared-types ./shared-types
COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm ci --omit=dev

COPY --from=builder /app/backend/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
