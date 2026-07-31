# ================================================================
# Stage 1: Base - Setup pnpm
# ================================================================
FROM node:24.14.0-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

WORKDIR /app


# ================================================================
# Stage 2: Dependencies
# ================================================================
FROM base AS deps

# Copy workspace configuration first (best for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy only package.json files for dependency resolution
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/env/package.json ./packages/env/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/transactional/package.json ./packages/transactional/package.json

# Install production dependencies with BuildKit cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prefer-offline --prod --ignore-scripts --frozen-lockfile

# ================================================================
# Stage 3: Builder
# ================================================================
FROM deps AS builder

# Copy source code
COPY apps/backend ./apps/backend
COPY packages ./packages

# Build if needed (uncomment if your app requires compilation)
# WORKDIR /app/apps/backend
# RUN pnpm run build

# ================================================================
# Stage 4: Production Runtime
# ================================================================
FROM base AS runner

# Copy workspace root files needed for pnpm filters and tsx path resolution
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Copy node_modules from deps stage, source files from builder stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/backend

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:8000/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

# Schema migrations are a separate release step.
CMD ["pnpm", "start"]
