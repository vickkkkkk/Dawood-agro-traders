# --- Build Frontend ---
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Build & Run Backend ---
FROM node:20-alpine
WORKDIR /app

# Install openssl for Prisma client
RUN apk add --no-cache openssl

# Copy server package files and install production deps
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev

# Copy prisma schema and generate client
COPY server/prisma ./prisma
RUN npx prisma generate

# Copy server source code
COPY server/src ./src

# Copy built frontend from client-builder
COPY --from=client-builder /app/client/dist /app/client/dist

# Expose server port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Start server
CMD ["npm", "start"]
