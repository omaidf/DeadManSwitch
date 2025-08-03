FROM node:24.4.1-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "start"]