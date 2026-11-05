import { scrypt, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { db } from '@stakeout/db';
const derive = promisify(scrypt);
export const SESSION_COOKIE_NAME = 'stakeout_uid';
const lifetime = 30 * 86400;
function signature(payload: string) {
  const key = process.env.AUTH_SECRET;
  if (!key || key.length < 32)
    throw new Error(
      'Set AUTH_SECRET to a random secret of at least 32 characters.',
    );
  return createHmac('sha256', key).update(payload).digest('base64url');
}
export function signSessionToken(id: string) {
  const payload = id + '.' + (Math.floor(Date.now() / 1000) + lifetime);
  return payload + '.' + signature(payload);
}
export function verifySessionToken(value?: string) {
  if (!value) return null;
  const parts = value.split('.');
  if (
    parts.length !== 3 ||
    !/^\d{10}$/.test(parts[1]) ||
    +parts[1] <= Date.now() / 1000
  )
    return null;
  const a = Buffer.from(parts[2]),
    b = Buffer.from(signature(parts[0] + '.' + parts[1]));
  return a.length === b.length && timingSafeEqual(a, b) ? parts[0] : null;
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex'),
    hash = (await derive(password, salt, 64)) as Buffer;
  return salt + ':' + hash.toString('hex');
}
export async function verifyPassword(password: string, value: string) {
  const [salt, key] = value.split(':');
  if (!salt || !key || key.length !== 128) return false;
  return timingSafeEqual(
    (await derive(password, salt, 64)) as Buffer,
    Buffer.from(key, 'hex'),
  );
}
export async function getAuthenticatedUser() {
  const id = verifySessionToken(
    (await cookies()).get(SESSION_COOKIE_NAME)?.value,
  );
  const user = id ? await db.user.findUnique({ where: { id } }) : null;
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
