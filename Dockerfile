# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the SPA ----------
FROM node:20-alpine AS builder
WORKDIR /app/frontend

# Install deps first for better layer caching.
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy sources and build the production bundle.
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: dev server (for `docker run` in dev mode) ----------
FROM node:20-alpine AS dev
WORKDIR /app/frontend
ENV NODE_ENV=development
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------- Stage 3: production static server (default target) ----------
FROM nginx:1.27-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
