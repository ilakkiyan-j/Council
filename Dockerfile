# Multi-stage Dockerfile for Council Service
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies & generate Prisma client
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source and build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4100

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/public ./src/public

EXPOSE 4100

CMD ["node", "dist/index.js"]
