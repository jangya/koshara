import {NextResponse} from 'next/server';

import {decideWorkspaceIntent} from '@/lib/decision/workspace-jev';

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({error: 'Invalid JSON'}, {status: 400}); }
  if (!body || typeof body !== 'object') return NextResponse.json({error: 'Invalid request'}, {status: 400});
  const {input, debug} = body as {input?: unknown; debug?: unknown};
  if (typeof input !== 'string' || !input.trim() || input.length > 500 || (debug !== undefined && typeof debug !== 'boolean')) {
    return NextResponse.json({error: 'Invalid workspace intent input'}, {status: 400});
  }
  return NextResponse.json(await decideWorkspaceIntent(input.trim(), debug === true));
}
