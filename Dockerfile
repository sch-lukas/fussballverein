# syntax=docker.io/docker/dockerfile-upstream:1.19.0
# check=error=true

ARG NODE_VERSION=25.0.0
ARG BASE_IMAGE_TAG=alpine3.22

FROM node:${NODE_VERSION}-${BASE_IMAGE_TAG} AS final

# Root: Tools + pnpm
RUN <<EOF
set -eux
apk update
apk add --no-cache python3 make gcc g++ dumb-init wget
npm i -g pnpm@latest-10
rm -rf /var/cache/apk/*
EOF

WORKDIR /opt/app
RUN chown -R node:node /opt/app
USER node

# pnpm-Skripte erlauben (z. B. prisma generate)
ENV PNPM_ALLOW_SCRIPTS="*" \
    PNPM_IGNORE_SCRIPTS="false"

# Projektdateien
COPY --chown=node:node package.json pnpm-lock.yaml .env ./
COPY --chown=node:node tsconfig.json tsconfig.build.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src/

# Install + Build (ohne npm postbuild)
RUN <<'EOF'
set -eux
pnpm config set store-dir /home/node/.pnpm-store
pnpm install
# Falls ein falsches "node" in node_modules/.bin liegt: entfernen
[ -f node_modules/.bin/node ] && rm -f node_modules/.bin/node || true

# Manuell statt "npm run build" (um postbuild zu umgehen):
pnpm run clean
pnpm exec prisma generate
pnpm exec nest build

# Produktionsdeps schlank
pnpm prune --prod
EOF

# Falls dein Build statische Ressourcen braucht: direkt kopieren
# (das ersetzt scripts/copy-resources.mts)
COPY --chown=node:node src/config/resources ./dist/config/resources

EXPOSE 3000
LABEL org.opencontainers.image.title="fussballverein" \
  org.opencontainers.image.version="2025.10.1-alpine" \
  org.opencontainers.image.authors="Dein Name"

ENTRYPOINT ["dumb-init", "/usr/local/bin/node", "dist/main.js"]
