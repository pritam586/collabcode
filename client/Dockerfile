# syntax=docker/dockerfile:1
# CollabCode web client: built with Vite, served by unprivileged nginx, which also proxies
# /api, /health and /socket.io to the server so the browser talks to a single origin.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# "same-origin" makes the app call the origin it was loaded from (see src/lib/serverUrl.js).
ARG VITE_SERVER_URL=same-origin
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
# The template only substitutes COLLABCODE_* variables, so nginx's own $variables survive.
ENV NGINX_ENVSUBST_FILTER=COLLABCODE_ \
    COLLABCODE_SERVER_UPSTREAM=server:4000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
