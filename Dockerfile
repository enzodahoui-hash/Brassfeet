# Football Manager BR — imagem para produção (jogo + contas + salvamentos na nuvem)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
VOLUME /data
EXPOSE 8080
CMD ["node", "server/index.mjs"]
