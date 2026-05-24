# syntax=docker/dockerfile:1.7
# Multi-stage build for the NestJS API. Final image is ~200MB and only
# contains production deps + compiled dist/.

# --- Stage 1: shared base with pnpm + native deps ---
FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

# --- Stage 2: install ALL workspace deps (cached on lockfile change only) ---
FROM base AS deps
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/app/package.json apps/app/package.json
COPY apps/www/package.json apps/www/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
RUN pnpm install --frozen-lockfile

# --- Stage 3: build the api ---
FROM deps AS builder
WORKDIR /repo
COPY . .
# Generate the Prisma client into the workspace's node_modules
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api run build

# --- Stage 4: extract a self-contained production bundle ---
FROM builder AS deployer
WORKDIR /repo
# `pnpm deploy` copies the workspace's prod-only deps + project files into /deploy
RUN pnpm --filter api --prod deploy --legacy /deploy

# --- Stage 5: minimal runtime ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r nodejs && useradd -r -g nodejs nestjs \
    && mkdir -p /app/uploads && chown -R nestjs:nodejs /app

COPY --from=deployer --chown=nestjs:nodejs /deploy ./

USER nestjs
ENV NODE_ENV=production \
    PORT=4000

EXPOSE 4000

CMD ["node", "dist/main.js"]
