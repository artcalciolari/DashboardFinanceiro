import './config/env';
import { createApp } from './app';
import prisma from './lib/prisma';

const app = createApp();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const server = app.listen(Number(PORT), HOST, () => {
  console.log(`Servidor rodando em ${HOST}:${PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
