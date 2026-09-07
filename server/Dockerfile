FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev
COPY server ./server
WORKDIR /app/server
EXPOSE 5000
CMD ["node", "src/server.js"]
