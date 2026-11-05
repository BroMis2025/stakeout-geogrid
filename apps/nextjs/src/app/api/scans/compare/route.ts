import { db } from '@stakeout/db';
import { report } from '@/lib/reports';
import { getAuthenticatedUser } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { InputError } from '@stakeout/core/grid';
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams,
      shared = p.get('public') === '1';
    let a = p.get('a'),
      b = p.get('b');
    if (!a && !b) throw new InputError('Select a scan.');
    const userId = shared ? undefined : (await getAuthenticatedUser()).id;
    const load = (value: string) =>
      db.gridScan.findFirst({
        where: shared ? { shareToken: value } : { id: value, userId },
        select: {
          id: true,
          userId: true,
          campaignId: true,
          createdAt: true,
          status: true,
        },
      });
    const primary = await load((b || a)!);
    if (!primary) throw new InputError('Comparison unavailable.', 404);
    const scope = {
      userId: primary.userId,
      campaignId: primary.campaignId,
      status: { in: ['COMPLETED', 'PARTIAL'] },
    };
    const history = shared
      ? []
      : await db.gridScan.findMany({
          where: scope,
          select: {
            id: true,
            createdAt: true,
            solv: true,
            atrp: true,
            arp: true,
            aioCitationRate: true,
            gridSize: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
    if (!a || !b) {
      if (shared) throw new InputError('Two shared reports are required.');
      const prev = await db.gridScan.findFirst({
        where: { ...scope, createdAt: { lt: primary.createdAt } },
        orderBy: { createdAt: 'desc' },
      });
      if (!prev)
        throw new InputError(
          'This campaign has no previous completed run.',
          404,
        );
      a = prev.id;
      b = primary.id;
    }
    const [left, right] = await Promise.all([load(a), load(b)]);
    if (
      !left ||
      !right ||
      left.userId !== right.userId ||
      left.campaignId !== right.campaignId ||
      left.id === right.id ||
      ![left.status, right.status].every((s) => scope.status.in.includes(s))
    )
      throw new InputError(
        'Select two finished runs of the same campaign.',
        404,
      );
    const [scanA, scanB] = await Promise.all([
      report(shared ? { shareToken: a } : { id: left.id, userId }),
      report(shared ? { shareToken: b } : { id: right.id, userId }),
    ]);
    return Response.json({ scanA, scanB, campaignHistory: history });
  } catch (e) {
    return errorResponse(e);
  }
}
