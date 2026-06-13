# syntax=docker/dockerfile:1.7

# Multi-stage Dockerfile for the pdlc-test frontend (Vite + TypeScript).
#
# Stages:
#   deps   - install pnpm dependencies (cacheable)
#   dev    - run the Vite dev server with HMR (used by docker compose --profile dev)
#   test   - run the Vitest suite (`docker build --target test .`)
#   build  - produce the static production bundle in /app/dist
#   prod   - serve /app/dist via nginx on :8080 with a /health endpoint (default)

ARG NODE_VERSION=20-alpine
ARG NGINX_VERSION=1.27-alpine
ARG PNPM_VERSION=9.12.0


# ---------- deps ----------
FROM node:${NODE_VERSION} AS deps
ARG PNPM_VERSION
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile


# ---------- dev ----------
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]


# ---------- test ----------
FROM deps AS test
ENV NODE_ENV=test
COPY . .
RUN pnpm test


# ---------- build ----------
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN pnpm run build


# ---------- prod ----------
FROM nginx:${NGINX_VERSION} AS prod
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
