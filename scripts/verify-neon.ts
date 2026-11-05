import { db } from '@stakeout/db';
import { randomUUID } from 'node:crypto';
async function run() {
  const marker = randomUUID() + '@internal.invalid';
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: marker, role: 'SYSTEM', creditBalance: 0 },
      });
      const saved = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (saved.email !== marker)
        throw Error('Transaction read did not match.');
      await tx.user.delete({ where: { id: user.id } });
    });
    console.log('Postgres transaction passed: insert, read and delete.');
  } finally {
    await db.$disconnect();
  }
}
run().catch(() => {
  console.error(
    'Database verification failed. Check URLs, migration status and network access.',
  );
  process.exitCode = 1;
});
