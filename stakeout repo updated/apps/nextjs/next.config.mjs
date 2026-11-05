export default {
  transpilePackages: ['@stakeout/db', '@stakeout/core'],
  experimental: { cpus: 2, authInterrupts: true },
  serverExternalPackages: ['@prisma/client', 'bullmq', 'ioredis', 'zipcodes'],
};
