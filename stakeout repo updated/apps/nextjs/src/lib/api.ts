import { NextResponse } from 'next/server';
import { InputError } from '@stakeout/core/grid';
export function errorResponse(e: unknown) {
  if (e instanceof InputError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof Error && e.message === 'UNAUTHORIZED')
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (e instanceof SyntaxError)
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  console.error('Request failed', e instanceof Error ? e.name : 'unknown');
  return NextResponse.json(
    { error: 'Service temporarily unavailable.' },
    { status: 503 },
  );
}
