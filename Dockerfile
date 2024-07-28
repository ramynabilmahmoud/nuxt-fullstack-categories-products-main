FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

RUN docker-compose exec nuxt-app npx prisma migrate deploy

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
