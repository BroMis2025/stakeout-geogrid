import { createHash } from 'node:crypto';
import { db } from '@stakeout/db';
import { InputError } from '@stakeout/core/grid';
export async function limit(
  scope: string,
  subject: string,
  max: number,
  seconds: number,
) {
  const key = createHash('sha256')
    .update(scope + ':' + subject)
    .digest('hex');
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "UsageBucket" (key,bucket,count) VALUES (${key},${bucket},1)
 ON CONFLICT (key) DO UPDATE SET bucket=EXCLUDED.bucket,count=CASE WHEN "UsageBucket".bucket=EXCLUDED.bucket THEN "UsageBucket".count+1 ELSE 1 END RETURNING count`;
  if (rows[0].count > max)
    throw new InputError('Request limit reached. Try again later.', 429);
}
export function clientKey(req: Request) {
  return (
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
    'shared-origin'
  );
}
