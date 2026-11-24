# syntax=docker/dockerfile:1

# Prisma 7 migrations use a platform-specific schema engine binary, so the
# backend build and migration stages use Debian (glibc) rather than Alpine.
FROM node:26-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.33.0

FROM base AS build
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate \
  && pnpm run build

# One-shot image for `prisma migrate deploy` and the existing seed script.
FROM build AS migrate
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
