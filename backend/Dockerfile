FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN npm install -g pnpm@11.9.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY tsconfig.json .
COPY src ./src

RUN pnpm exec prisma generate
RUN pnpm run build

EXPOSE 3001

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
