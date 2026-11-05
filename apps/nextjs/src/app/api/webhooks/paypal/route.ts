import { db } from '@stakeout/db';
import { fulfill, paypal } from '@/lib/paypal';
import { errorResponse } from '@/lib/api';
import { InputError } from '@stakeout/core/grid';
export async function POST(req: Request) {
  try {
    const e = await req.json(),
      h = req.headers;
    if (!process.env.PAYPAL_WEBHOOK_ID)
      throw new InputError('Webhook is awaiting configuration.', 503);
    const verify = await paypal(
      '/v1/notifications/verify-webhook-signature',
      'POST',
      {
        auth_algo: h.get('paypal-auth-algo'),
        cert_url: h.get('paypal-cert-url'),
        transmission_id: h.get('paypal-transmission-id'),
        transmission_sig: h.get('paypal-transmission-sig'),
        transmission_time: h.get('paypal-transmission-time'),
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: e,
      },
    );
    if (verify.verification_status !== 'SUCCESS')
      throw new InputError('Invalid webhook signature.', 401);
    if (e.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const id = e.resource?.supplementary_data?.related_ids?.order_id;
      if (
        typeof id === 'string' &&
        (await db.paymentOrder.findUnique({ where: { id } }))
      )
        await fulfill(id);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
