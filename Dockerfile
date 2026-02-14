# Build Stage 1: Rust/WASM Core
FROM rust:1.75-slim as rust-builder

WORKDIR /app

# Install wasm-pack and build essentials
RUN apt-get update && apt-get install -y pkg-config libssl-dev
RUN cargo install wasm-pack

COPY packages/core-rust ./packages/core-rust

# Build WASM for Node.js
WORKDIR /app/packages/core-rust
RUN wasm-pack build --target nodejs --out-dir pkg-node

# Build Stage 2: Node.js Server
FROM node:20-slim as node-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy ALL package.json files to allow pnpm to resolve workspace dependencies
COPY apps/server-guardian/package.json ./apps/server-guardian/package.json
COPY packages/core-rust/package.json ./packages/core-rust/package.json
COPY packages/engine/package.json ./packages/engine/package.json
COPY packages/games/ngu-hanh/package.json ./packages/games/ngu-hanh/package.json

# Copy built WASM package from previous stage (needs to be present for pnpm install if referenced via file:)
COPY --from=rust-builder /app/packages/core-rust/pkg-node ./packages/core-rust/pkg-node

# Install dependencies (frozen lockfile for reproducibility)
# We use --ignore-scripts to avoid running lifecycle scripts that might fail (e.g. postinstall)
# unless strictly necessary.
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/server-guardian ./apps/server-guardian
COPY packages/games ./packages/games
COPY packages/engine ./packages/engine
COPY packages/core-rust ./packages/core-rust

# Build Server
WORKDIR /app/apps/server-guardian
# Generate Prisma Client
RUN npx prisma generate
RUN pnpm build

# Build Stage 3: Production Runtime
FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Set Production Environment
ENV NODE_ENV=production
ENV PORT=2567

# Copy necessary files from builder
COPY --from=node-builder /app/package.json ./package.json
COPY --from=node-builder /app/node_modules ./node_modules

# Copy workspace packages (engine/games might be needed at runtime if compiled code refers to them or if they are just TS)
# Actually, the server 'dist' usually bundles code, or refers to it.
# If 'dist' is commonjs and requires sibling packages, we need them.
# 'server-guardian' build script is 'tsc'. It emits to 'dist'.
# If it uses project references, it might rely on structure.
# For safety, let's copy the built artifacts and node_modules of workspaces.

COPY --from=node-builder /app/apps/server-guardian/dist ./dist
COPY --from=node-builder /app/apps/server-guardian/node_modules ./node_modules
COPY --from=node-builder /app/apps/server-guardian/prisma ./prisma
COPY --from=node-builder /app/packages/core-rust/pkg-node ./packages/core-rust/pkg-node

EXPOSE 2567

CMD ["node", "dist/index.js"]
