FROM node:20-alpine AS build

WORKDIR /app

# Monorepo root package is required because client depends on "lms-ai-system": "file:.."
COPY package.json ./
COPY client/package.json client/package-lock.json* ./client/

WORKDIR /app/client
RUN npm ci || npm install

COPY client/ ./
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache curl

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1/ || exit 1
