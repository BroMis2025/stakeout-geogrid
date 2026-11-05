import { randomBytes } from 'node:crypto';
import { db } from '@stakeout/db';
import { report } from '@/lib/reports';
import { getAuthenticatedUser } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { InputError, scheduleCron } from '@stakeout/core/grid';
type C = { params: Promise<{ scanId: string }> };
export async function GET(_: Request, c: C) {
  try {
    return Response.json(
      await report({
        id: (await c.params).scanId,
        userId: (await getAuthenticatedUser()).id,
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request, c: C) {
  try {
    const id = (await c.params).scanId,
      userId = (await getAuthenticatedUser()).id;
    const s = await db.gridScan.findFirst({ where: { id, userId } });
    if (!s) throw new InputError('Scan unavailable.', 404);
    const { action } = await req.json();
    if (action === 'share') {
      await db.gridScan.updateMany({
        where: { id, userId, shareToken: null },
        data: { shareToken: randomBytes(24).toString('hex') },
      });
      const record = await db.gridScan.findUniqueOrThrow({
        where: { id },
        select: { shareToken: true },
      });
      return Response.json({ path: '/share/' + record.shareToken });
    }
    if (action === 'revoke') {
      await db.gridScan.update({ where: { id }, data: { shareToken: null } });
      return Response.json({ ok: true });
    }
    const cron = scheduleCron(s.scheduleType);
    if (!cron || !['pause', 'resume'].includes(action))
      throw new InputError('Invalid schedule action.');
    await db.gridScan.update({
      where: { id },
      data: { scheduleCron: action === 'pause' ? 'PAUSED:' + cron : cron },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
