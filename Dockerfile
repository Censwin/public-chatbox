FROM node:18-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./
COPY public ./public

EXPOSE 80
ENV PORT=80

CMD ["node", "server.js"]
