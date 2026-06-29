FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

COPY tsconfig.json .
COPY src ./src

RUN npx prisma generate
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
