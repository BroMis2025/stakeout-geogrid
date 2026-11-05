import { db } from '@stakeout/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { signedRead } from '@stakeout/core/r2';
import { InputError } from '@stakeout/core/grid';
import { errorResponse } from '@/lib/api';
export async function GET(
  req: Request,
  c: { params: Promise<{ pinId: string }> },
) {
  try {
    const p = new URL(req.url).searchParams,
      share = p.get('share'),
      kind = p.get('kind') ?? 'video';
    if (
      !['video', 'meta', 'bundle'].includes(kind) ||
      (share && kind !== 'video')
    )
      throw new InputError('Unavailable proof.', 404);
    const scope = share
      ? { shareToken: share }
      : { userId: (await getAuthenticatedUser()).id };
    const pin = await db.gridPin.findFirst({
      where: { id: (await c.params).pinId, scan: scope },
    });
    const key =
      pin &&
      (kind === 'video'
        ? pin.videoUrl
        : kind === 'meta'
          ? pin.metaJsonUrl
          : pin.dumpsTarUrl);
    if (!pin || !key) throw new InputError('Proof unavailable.', 404);
    let objectKey = key;
    if (key.startsWith('https://')) {
      const u = new URL(key);
      objectKey = decodeURIComponent(u.pathname.slice(1));
    }
    if (!objectKey.startsWith('scans/' + pin.scanId + '/'))
      throw new InputError('Proof unavailable.', 404);
    return new Response(null, {
      status: 307,
      headers: {
        Location: await signedRead(objectKey),
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
