import { NextResponse } from 'next/server';
import { runSentinel } from '@/lib/sentinel';

// Processes the Sentinel queue. Called every minute by the database's scheduler (and nudged on page loads).
// It only ever checks content already waiting in the queue, so calling it more often does no harm.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle() {
  try { return NextResponse.json(await runSentinel(20)); }
  catch (e) { console.error('[sentinel]', e); return NextResponse.json({ error: 'failed' }, { status: 500 }); }
}
export const GET = handle;
export const POST = handle;
