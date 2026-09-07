FROM node:20-alpine AS build
WORKDIR /app
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client ./
RUN npm run build

FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
