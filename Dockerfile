# syntax=docker.io/docker/dockerfile-upstream:1.19.0
# check=error=true

# ---- Basis-Image ----
ARG NODE_VERSION=25.0.0
ARG BASE_IMAGE_TAG=alpine3.22
FROM node:${NODE_VERSION}-${BASE_IMAGE_TAG} AS final

# ---- Systemtools & pnpm ----
RUN <<EOF
set -eux
apk update
apk add --no-cache python3 make gcc g++ dumb-init wget
npm i -g pnpm@latest-10
rm -rf /var/cache/apk/*
EOF

# ---- Arbeitsverzeichnis ----
WORKDIR /opt/app
RUN chown -R node:node /opt/app
USER node

# ---- pnpm-Konfiguration ----
ENV PNPM_ALLOW_SCRIPTS="*" \
    PNPM_IGNORE_SCRIPTS="false"

# ---- Projektdateien kopieren ----
COPY --chown=node:node package.json pnpm-lock.yaml ./

# Optional: .env, falls lokal vorhanden (CI läuft ohne Fehler weiter)
RUN if [ -f .env ]; then echo ".env gefunden"; else touch .env; fi
COPY --chown=node:node .env ./

COPY --chown=node:node tsconfig.json tsconfig.build.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src/

# ---- Abhängigkeiten installieren & Build ----
RUN <<'EOF'
set -eux
pnpm config set store-dir /home/node/.pnpm-store
pnpm install --frozen-lockfile

# Entferne ggf. falschen Symlink zu node in node_modules/.bin
[ -f node_modules/.bin/node ] && rm -f node_modules/.bin/node || true

# Manuelles Build ohne postbuild
pnpm run clean
pnpm exec prisma generate
pnpm exec nest build

# Produktionsabhängigkeiten reduzieren
pnpm prune --prod
EOF

# ---- Ressourcen (TLS, Konfiguration, Prisma) ----
# Falls TLS fehlt (z. B. im CI), wird ein Dummy-Zertifikat erzeugt
RUN <<'EOF'
set -eux
mkdir -p dist/config/resources/tls
if [ ! -f src/config/resources/tls/key.pem ]; then
  echo "⚠️ Kein TLS-Key gefunden – Dummy wird erstellt"
  echo "-----BEGIN PRIVATE KEY-----\nFAKEKEY\n-----END PRIVATE KEY-----" > dist/config/resources/tls/key.pem
  echo "-----BEGIN CERTIFICATE-----\nFAKECERT\n-----END CERTIFICATE-----" > dist/config/resources/tls/certificate.crt
else
  cp -r src/config/resources ./dist/config/resources
fi
EOF

# Prisma-Client mitnehmen (wurde in CI erzeugt)
COPY --chown=node:node src/generated/prisma ./dist/generated/prisma

# ---- Startkonfiguration ----
EXPOSE 3000
LABEL org.opencontainers.image.title="fussballverein" \
  org.opencontainers.image.version="2025.10.1" \
  org.opencontainers.image.authors="Lukas Schulz / Juergen Zimmermann HKA"

ENTRYPOINT ["dumb-init", "node", "dist/src/main.js"]
