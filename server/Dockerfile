FROM node:20-alpine

RUN apk add --no-cache su-exec

WORKDIR /app

# Root package is required because server depends on "lms-ai-system": "file:.."
COPY package.json ./
COPY server/package.json server/package-lock.json* ./server/

WORKDIR /app/server
RUN npm ci --omit=dev || npm install --omit=dev

COPY server/ ./
COPY server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p uploads private-pdfs uploads/covers \
  && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
