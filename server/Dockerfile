# syntax=docker/dockerfile:1
# CollabCode server: Express + Socket.io + SQLite (node:sqlite needs Node 22.13 or newer).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine
# The Docker code runner needs the docker CLI. It is only installed when asked for, because
# using it also means mounting the host's Docker socket (see docker-compose.runner.yml).
ARG WITH_DOCKER_CLI=false
RUN if [ "$WITH_DOCKER_CLI" = "true" ]; then apk add --no-cache docker-cli; fi

WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_PATH=/app/data/collabcode.db \
    LOG_FORMAT=json
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
RUN mkdir -p /app/data && chown node:node /app/data

USER node
VOLUME ["/app/data"]
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# The server handles SIGTERM itself (saves rooms, closes the database), so run node directly.
CMD ["node", "src/index.js"]
