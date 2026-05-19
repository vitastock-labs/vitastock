# ================================================================
# Stage 1: Base - Setup pnpm
# ================================================================
FROM node:24.14.0-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

# ================================================================
# Stage 2: Runner
# ================================================================
FROM base AS runner

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/env ./packages/env

# Install only production dependencies with BuildKit cache
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

WORKDIR /app/packages/db

CMD ["sh", "-c", "pnpm db:push && pnpm db:seed"]