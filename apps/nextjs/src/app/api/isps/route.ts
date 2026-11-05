import { market, InputError } from '@stakeout/core/grid';
import { getAuthenticatedUser } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { ispDirectory } from '@/lib/ispDirectory';
export async function GET(req: Request) {
  try {
    await getAuthenticatedUser();
    const p = new URL(req.url).searchParams,
      lat = Number(p.get('lat')),
      lng = Number(p.get('lng'));
    if (
      !p.has('lat') ||
      !p.has('lng') ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    )
      throw new InputError('Coordinates required.');
    return Response.json({
      detectedMarket: market(lat, lng),
      isps: ispDirectory,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
