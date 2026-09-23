import {NextResponse} from 'next/server';

import {classifyWithJev, type JevRow} from '@/lib/statement-parser/jev';

const categories = new Set(['FOOD', 'GROCERIES', 'SHOPPING', 'TRANSPORT', 'UTILITIES', 'RENT', 'EMI', 'TRANSFER', 'SALARY', 'INVESTMENT', 'HEALTHCARE', 'ENTERTAINMENT', 'FEES', 'OTHER']);

export async function POST(request: Request) {
  let rows: unknown;
  try {
    rows = (await request.json() as {rows?: unknown}).rows;
  } catch {
    return NextResponse.json({error: 'Invalid JSON'}, {status: 400});
  }
  if (!Array.isArray(rows) || rows.length > 500 || !rows.every((row): row is JevRow =>
    row && typeof row === 'object' && typeof row.date === 'string' && row.date.length <= 32
    && typeof row.description === 'string' && row.description.length <= 1000
    && typeof row.amountMinor === 'number' && Number.isFinite(row.amountMinor)
    && (row.kind === 'expense' || row.kind === 'income')
    && typeof row.sourcePage === 'number' && typeof row.confidence === 'number'
    && (row.knownCategory === undefined || categories.has(row.knownCategory)))) {
    return NextResponse.json({error: 'Invalid transaction rows'}, {status: 400});
  }
  const decisions = await classifyWithJev(rows);
  return NextResponse.json({decisions});
}
