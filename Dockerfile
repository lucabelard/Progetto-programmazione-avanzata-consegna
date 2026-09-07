# ─────────────────────────────────────────────
# Stage 1: Development (hot-reload con ts-node-dev)
# ─────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

# Installa le dipendenze di sistema necessarie per alcune librerie native
RUN apk add --no-cache python3 make g++

# Copia i file di configurazione delle dipendenze
COPY package*.json ./
COPY tsconfig.json ./

# Installa TUTTE le dipendenze (incluse devDependencies)
RUN npm install

# Copia il codice sorgente
COPY src/ ./src/

EXPOSE 3000

# Avvia con ts-node-dev per hot-reload automatico
CMD ["npm", "run", "dev"]

# ─────────────────────────────────────────────
# Stage 2: Builder (compila TypeScript → JavaScript)
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

COPY src/ ./src/
RUN node node_modules/typescript/bin/tsc

# ─────────────────────────────────────────────
# Stage 3: Production (solo JS compilato, immagine minimale)
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Copia i file compilati dallo stage builder
COPY --from=builder /app/dist ./dist

# Utente non-root per sicurezza
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
