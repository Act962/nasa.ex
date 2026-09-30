# syntax=docker/dockerfile:1.7
#
# Imagem de produção do NASA. Construída no GitHub Actions (.github/workflows/deploy-image.yml)
# e publicada no GHCR — o Coolify só faz `pull`, sem compilar nada na VPS.
# Detalhes e passo a passo do Coolify: docs/DEPLOYMENT.md.
#
#   deps    → instala dependências (só depende de package.json + lockfile: cacheável)
#   builder → `prisma generate` + `next build` (gera .next/standalone)
#   runner  → só o standalone + a CLI do Prisma para `migrate deploy` no boot
#
# Debian (glibc), não Alpine: sharp e @napi-rs/canvas trazem binários pré-compilados para glibc.

ARG NODE_VERSION=22
ARG PRISMA_VERSION=7.7.0
ARG DOTENV_VERSION=17.3.1

# ─── base ────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
	PATH=/pnpm:$PATH \
	COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
	NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ─── deps ────────────────────────────────────────────────────────────────────
FROM base AS deps
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates openssl \
	&& rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
	pnpm config set store-dir /pnpm/store \
	&& pnpm install --frozen-lockfile

# ─── builder ─────────────────────────────────────────────────────────────────
FROM deps AS builder
ARG BUILD_HEAP_MB=8192
ARG SKIP_TYPECHECK=0
# Só para o `next build` carregar os módulos de auth; o estágio `runner` não herda e usa o do Coolify.
ENV BETTER_AUTH_SECRET=build-only-placeholder-never-used-at-runtime
COPY . .

# Variáveis NEXT_PUBLIC_* são embutidas no bundle do browser em tempo de build. Chegam como
# secret (arquivo .env.production com só as NEXT_PUBLIC_*), sem virar camada da imagem.
# Sem o secret o build passa, mas o front sai sem essas configs. O `.next/cache` sai da camada:
# a imagem não usa e ele só incharia o cache de build exportado a cada deploy.
RUN --mount=type=secret,id=public_env,target=/app/.env.production,required=false \
	DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm exec prisma generate \
	&& (pnpm exec tsx scripts/legal/sync-orbita-legal.ts || true) \
	&& SKIP_TYPECHECK=${SKIP_TYPECHECK} NODE_OPTIONS=--max-old-space-size=${BUILD_HEAP_MB} pnpm exec next build \
	&& rm -rf .next/cache

# ─── runner ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ARG PRISMA_VERSION
ARG DOTENV_VERSION
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0
WORKDIR /app

# openssl: o schema-engine do Prisma linka a libssl.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates openssl \
	&& rm -rf /var/lib/apt/lists/*

# CLI do Prisma isolada, só para `migrate deploy` no boot (o standalone não leva a CLI).
WORKDIR /migrator
RUN npm init -y >/dev/null \
	&& npm install --no-audit --no-fund --omit=dev prisma@${PRISMA_VERSION} dotenv@${DOTENV_VERSION}
COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations

WORKDIR /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chmod=755 docker/entrypoint.sh /entrypoint.sh
RUN chown -R node:node /migrator

USER node
EXPOSE 3000

# start-period cobre o `migrate deploy` que roda antes do servidor subir. Segue o PORT do
# container: o Coolify pode sobrescrevê-lo, e um healthcheck fixo na 3000 deixaria o app
# `unhealthy` (o Traefik então responde "no available server").
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]

ENTRYPOINT ["/entrypoint.sh"]
