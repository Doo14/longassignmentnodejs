# === Stage 1: Build TypeScript → JavaScript ===
FROM node:20-alpine AS builder

WORKDIR /app

# Copy file package trước → tận dụng Docker cache cho npm install
COPY package*.json ./
RUN npm ci

# Copy toàn bộ source code và build
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# === Stage 2: Production image (nhẹ hơn) ===
FROM node:20-alpine

WORKDIR /app

# Chỉ copy file cần thiết từ stage build
COPY package*.json ./
RUN npm ci --omit=dev

# Copy code đã build (JavaScript) từ stage 1
COPY --from=builder /app/dist ./dist

# Copy schema.json để migration đọc được
COPY schema.json ./

# Expose port cho container
EXPOSE 3000

# Chạy server bằng Node.js (không cần ts-node trong production)
CMD ["node", "dist/index.js"]
