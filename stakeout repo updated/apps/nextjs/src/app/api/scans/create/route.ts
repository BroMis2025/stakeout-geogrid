import { randomUUID } from 'node:crypto';
import { createScan } from '@stakeout/core/scans';
import { parseSpec, InputError } from '@stakeout/core/grid';
import { getAuthenticatedUser } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
export async function POST(req: Request) {
  try {
    const u = await getAuthenticatedUser(),
      s = parseSpec(await req.json());
    const key = req.headers.get('Idempotency-Key') ?? randomUUID();
    if (!/^[\w-]{8,80}$/.test(key))
      throw new InputError('Invalid request key.');
    const scan = await createScan(u.id, s, u.id + ':' + key);
    return Response.json(
      { scanId: scan.id, creditsCharged: scan.creditsCharged },
      { status: 202 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
