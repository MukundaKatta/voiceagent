FROM node:22-slim AS base
RUN corepack enable pnpm

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/voice-server/package.json apps/voice-server/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
COPY packages/supabase/package.json packages/supabase/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/voice-server/ apps/voice-server/

# Build
WORKDIR /app/apps/voice-server
RUN pnpm build

# Production
FROM node:22-slim
WORKDIR /app
COPY --from=base /app/apps/voice-server/dist ./dist
COPY --from=base /app/apps/voice-server/package.json ./
COPY --from=base /app/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/server.js"]
