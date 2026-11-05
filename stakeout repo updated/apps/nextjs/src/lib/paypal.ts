import { db } from '@stakeout/db';
import { InputError } from '@stakeout/core/grid';
export const packs = [500, 750, 3000, 7500];
export function catalog() {
  return packs
    .map((credits) => ({
      credits,
      cents: Number(process.env['PAYPAL_PACK_' + credits + '_USD_CENTS']),
    }))
    .filter(
      (p) =>
        Number.isSafeInteger(p.cents) && p.cents > 0 && p.cents <= 10000000,
    );
}
export async function paypal(
  path: string,
  method = 'GET',
  body?: unknown,
  requestId?: string,
) {
  const base =
    process.env.PAYPAL_API_BASE ?? 'https://api-m.sandbox.paypal.com';
  if (
    !['https://api-m.sandbox.paypal.com', 'https://api-m.paypal.com'].includes(
      base,
    )
  )
    throw new Error('Invalid PayPal base');
  const key = process.env.PAYPAL_CLIENT_ID,
    secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!key || !secret)
    throw new InputError('PayPal checkout is awaiting configuration.', 503);
  const auth = await fetch(base + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization:
        'Basic ' + Buffer.from(key + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!auth.ok) throw new Error('PayPal authentication failed');
  const token = (await auth.json()).access_token;
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new InputError('PayPal could not complete this operation.', 502);
  return response.json();
}
export async function fulfill(orderId: string) {
  const purchase = await db.paymentOrder.findUnique({ where: { id: orderId } });
  if (!purchase) throw new InputError('Unknown order.', 404);
  const order = await paypal(
    '/v2/checkout/orders/' + encodeURIComponent(orderId),
  );
  const unit = order.purchase_units?.[0],
    captures = unit?.payments?.captures ?? [],
    c = captures[0];
  if (
    order.status !== 'COMPLETED' ||
    order.purchase_units?.length !== 1 ||
    captures.length !== 1 ||
    c?.status !== 'COMPLETED' ||
    !c.id ||
    unit.custom_id !== purchase.userId + ':PACK_' + purchase.credits ||
    c.amount?.currency_code !== 'USD' ||
    c.amount.value !== (purchase.cents / 100).toFixed(2) ||
    !process.env.PAYPAL_MERCHANT_ID ||
    unit.payee?.merchant_id !== process.env.PAYPAL_MERCHANT_ID
  )
    throw new InputError(
      'Payment is pending or could not be matched to this credit pack.',
      409,
    );
  return db.$transaction(async (tx) => {
    const claimed = await tx.paymentOrder.updateMany({
      where: { id: orderId, captureId: null },
      data: { captureId: c.id },
    });
    if (claimed.count) {
      await tx.creditLedger.create({
        data: {
          userId: purchase.userId,
          amount: purchase.credits,
          reason: 'PAYPAL_TOPUP',
          externalEventId: 'paypal:' + c.id,
        },
      });
      await tx.user.update({
        where: { id: purchase.userId },
        data: { creditBalance: { increment: purchase.credits } },
      });
    }
    return tx.user.findUniqueOrThrow({
      where: { id: purchase.userId },
      select: { creditBalance: true },
    });
  });
}
