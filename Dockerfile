FROM node:24-bookworm-slim AS build

ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/
RUN npm ci \
  && npm --prefix client ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/client/dist ./client/dist
COPY --from=build --chown=node:node /app/config ./config
COPY --from=build --chown=node:node /app/knowledge-base-public ./knowledge-base-public

RUN mkdir -p data cache logs knowledge-base \
  && chown -R node:node /app

USER node
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
