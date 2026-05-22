# syntax=docker/dockerfile:1.7
# Multi-stage build for the public Next.js site (www). Uses Next's standalone
# output so the runtime image is ~200MB.

FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

FROM base AS deps
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/app/package.json apps/app/package.json
COPY apps/www/package.json apps/www/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /repo
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build args for client-side env vars baked into the bundle at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WWW_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WWW_URL=$NEXT_PUBLIC_WWW_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN pnpm --filter www run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

# Standalone output: server.js + a slim node_modules tree, both already at the
# workspace root inside .next/standalone.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/www/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/www/.next/static ./apps/www/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/www/public ./apps/www/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/www/server.js"]
