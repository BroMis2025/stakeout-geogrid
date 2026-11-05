// packages/db/index.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';
// Required for Node.js environments (Railway worker & local/Codespaces verification)
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}
const connectionString = process.env.DATABASE_URL!;
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
function createNeonPrismaClient() {
  if (process.env.DB_TRANSPORT === 'tcp') return new PrismaClient();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}
export const db = globalForPrisma.prisma ?? createNeonPrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
export * from '@prisma/client';
