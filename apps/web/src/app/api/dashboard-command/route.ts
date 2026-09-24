import {NextResponse} from 'next/server';
import {classifyDashboardCommand} from '@/lib/decision/dashboard-composition-jev';
import {isDashboardWidgetType} from '@/lib/dashboard-definition';

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({error: 'Invalid JSON'}, {status: 400}); }
  if (!body || typeof body !== 'object') return NextResponse.json({error: 'Invalid request'}, {status: 400});
  const data = body as Record<string, unknown>;
  if (typeof data.input !== 'string' || data.input.trim().length < 3 || data.input.length > 500 || !Array.isArray(data.widgets) || data.widgets.length > 30
    || !data.widgets.every((item) => item && typeof item.id === 'string' && isDashboardWidgetType(item.type) && typeof item.title === 'string')
    || !Array.isArray(data.accounts) || !data.accounts.every((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
    || !Array.isArray(data.categories) || !data.categories.every((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
    || !(data.lastActiveWidgetId === null || typeof data.lastActiveWidgetId === 'string')) return NextResponse.json({error: 'Invalid dashboard command'}, {status: 400});
  try {
    const decision = await classifyDashboardCommand(data.input.trim(), data.widgets, data.accounts, data.categories, data.lastActiveWidgetId);
    return NextResponse.json({decision});
  } catch { return NextResponse.json({decision: null}); }
}
