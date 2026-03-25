# CDN Manager — Dockerfile
# Credits: Developed by iddigital.pt

FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy source
COPY server/ ./server/
COPY admin/  ./admin/

# Create data directory (including SSL subdirectory)
RUN mkdir -p data/ssl

# Set non-root user
RUN addgroup -S cdn && adduser -S cdn -G cdn && chown -R cdn:cdn /app
USER cdn

ENV NODE_ENV=production \
    CDN_PORT=3000 \
    ADMIN_PORT=3001 \
    LOG_LEVEL=info

EXPOSE 3000 3001 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/api/status || exit 1

CMD ["node", "server/index.js"]
