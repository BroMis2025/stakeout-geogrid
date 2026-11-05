import Redis from 'ioredis';
let client: Redis | undefined;
export function redis() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required.');
  return (client ??= new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }));
}
export async function duoplusPost(
  endpoint: string,
  payload: Record<string, unknown>,
) {
  const key = 'rl:duoplus:' + endpoint;
  while (!(await redis().set(key, '1', 'PX', 1150, 'NX'))) {
    await new Promise((resolve) =>
      setTimeout(resolve, 200 + Math.random() * 160),
    );
  }
  const response = await fetch('https://openapi.duoplus.net' + endpoint, {
    method: 'POST',
    headers: {
      'DuoPlus-API-Key': process.env.DUOPLUS_API_KEY!,
      'Content-Type': 'application/json',
      Lang: 'en',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error('DuoPlus ' + endpoint + ' HTTP ' + response.status);
  const result = await response.json();
  if (
    result.code !== 200 ||
    result.data?.fail?.length ||
    Object.values(result.data ?? {}).some((v: any) => v?.success === false)
  ) {
    throw new Error('DuoPlus rejected ' + endpoint);
  }
  return result;
}
