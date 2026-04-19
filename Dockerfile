# ─── Build Stage ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Production Stage ────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy deps from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source
COPY package.json ./
COPY server.js ./
COPY public/ ./public/

# HuggingFace Spaces injects PORT=7860, local default is 3000
ENV PORT=3000
EXPOSE 3000 7860

CMD ["node", "server.js"]
