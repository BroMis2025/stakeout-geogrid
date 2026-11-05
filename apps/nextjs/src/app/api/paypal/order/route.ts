import { randomUUID } from 'node:crypto';
import { getAuthenticatedUser } from '@/lib/auth';
import { catalog, paypal } from '@/lib/paypal';
import { db } from '@stakeout/db';
import { errorResponse } from '@/lib/api';
import { InputError } from '@stakeout/core/grid';
export async function GET() {
  try {
    await getAuthenticatedUser();
    return Response.json({ packs: catalog() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    const u = await getAuthenticatedUser(),
      { credits } = await req.json(),
      pack = catalog().find((p) => p.credits === credits);
    if (!pack || !process.env.PAYPAL_MERCHANT_ID)
      throw new InputError('This credit pack is unavailable.');
    const o = await paypal(
      '/v2/checkout/orders',
      'POST',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: u.id + ':PACK_' + credits,
            description: credits + ' Stakeout credits',
            payee: { merchant_id: process.env.PAYPAL_MERCHANT_ID },
            amount: {
              currency_code: 'USD',
              value: (pack.cents / 100).toFixed(2),
            },
          },
        ],
      },
      randomUUID(),
    );
    await db.paymentOrder.create({
      data: { id: o.id, userId: u.id, credits, cents: pack.cents },
    });
    return Response.json({ orderID: o.id });
  } catch (e) {
    return errorResponse(e);
  }
}
