import { db } from '@stakeout/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { fulfill, paypal } from '@/lib/paypal';
import { errorResponse } from '@/lib/api';
import { InputError } from '@stakeout/core/grid';
export async function POST(req: Request) {
  try {
    const u = await getAuthenticatedUser(),
      { orderID } = await req.json();
    const o =
      typeof orderID === 'string'
        ? await db.paymentOrder.findFirst({
            where: { id: orderID, userId: u.id },
          })
        : null;
    if (!o) throw new InputError('Order unavailable.', 404);
    const path = '/v2/checkout/orders/' + encodeURIComponent(o.id);
    if (!o.captureId && (await paypal(path)).status !== 'COMPLETED')
      await paypal(path + '/capture', 'POST', {}, 'capture-' + o.id);
    return Response.json(await fulfill(o.id));
  } catch (e) {
    return errorResponse(e);
  }
}
