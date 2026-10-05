import {parseAmountMinor} from './amount';
import {parseStatementDate} from './date';
import {groupIntoLines} from './layout';
import {reconcileStatement} from './reconcile';
import type {ParseResult, ParsedTransaction, PdfLine, PdfTextItem} from './types';

type Column = 'date' | 'description' | 'debit' | 'credit' | 'amount' | 'balance' | 'rewards' | 'other';
type Header = {page: number; y: number; anchors: Partial<Record<Column, number>>; inferred?: boolean};

const headerWords: Array<[Column, RegExp]> = [
  ['date', /^(?:(?:txn|transaction|posting|posted|value)?\s*date(?:\s*&\s*time)?|posted\s+on)$/i],
  ['description', /^(?:description|particulars|narration|details|merchant(?:\s*\/\s*reference)?|transaction\s*(?:details|description))$/i],
  ['debit', /^(?:debit|withdrawals?|charges?|purchases?|dr)$/i],
  ['credit', /^(?:credit|deposits?|payments?|cr)$/i],
  ['amount', /^(?:amount|transaction\s+amount)$/i],
  ['balance', /^(?:(?:running|available|outstanding|closing)\s+)?balance$/i],
  ['rewards', /^rewards?$/i],
  ['other', /^PI$/i],
];

function detectHeader(line: PdfLine): Header | null {
  const anchors: Header['anchors'] = {};
  for (const item of line.items) {
    const text = item.text.trim().replace(/[₹:$()]/g, '').trim();
    const found = headerWords.find(([, pattern]) => pattern.test(text));
    if (found) anchors[found[0]] = item.x;
  }
  if (anchors.date === undefined || anchors.description === undefined || (anchors.debit === undefined && anchors.amount === undefined)) return null;
  return {page: line.page, y: line.y, anchors};
}

function inferHeaders(lines: PdfLine[]): Map<number, Header> {
  const pages = new Map<number, PdfLine[]>();
  for (const line of lines) pages.set(line.page, [...(pages.get(line.page) ?? []), line]);
  const inferred = new Map<number, Header>();
  for (const [page, pageLines] of pages) {
    if (pageLines.some(detectHeader)) continue;
    const candidates = pageLines.flatMap((line) => {
      const dateItem = line.items.find(({text}) => parseStatementDate(text) !== null);
      if (!dateItem || isSummary(line)) return [];
      const right = line.items.filter(({x}) => x > dateItem.x + 15);
      const money = right.filter(({text}) => parseAmountMinor(text) !== null);
      const description = right.find(({text}) => parseAmountMinor(text) === null && parseStatementDate(text) === null);
      return money.length && description ? [{line, dateItem, description, money}] : [];
    });
    if (candidates.length < 2) continue;
    const aligned = candidates.filter(({dateItem, description}) =>
      Math.abs(dateItem.x - candidates[0]!.dateItem.x) <= 12
      && Math.abs(description.x - candidates[0]!.description.x) <= 18);
    if (aligned.length < 2) continue;
    const positions = aligned.flatMap(({money}) => money.map(({x}) => x)).sort((a, b) => a - b);
    const clusters: number[] = [];
    for (const x of positions) {
      const last = clusters.at(-1);
      if (last === undefined || x - last > 18) clusters.push(x);
    }
    if (clusters.length < 1 || clusters.length > 2
      || aligned.some(({money}) => money.some(({x}) => !clusters.some((anchor) => Math.abs(anchor - x) <= 18)))) continue;
    const first = aligned[0]!;
    const anchors: Header['anchors'] = {date: first.dateItem.x, description: first.description.x, amount: clusters[0]};
    if (clusters.length === 2) anchors.balance = clusters[1];
    inferred.set(page, {page, y: first.line.y + 1, anchors, inferred: true});
  }
  return inferred;
}

function columnFor(x: number, anchors: Header['anchors']): Column {
  const columns = Object.entries(anchors).sort((a, b) => a[1] - b[1]) as Array<[Column, number]>;
  let column = columns[0]![0];
  for (let i = 1; i < columns.length; i++) {
    if (x >= (columns[i - 1]![1] + columns[i]![1]) / 2) column = columns[i]![0];
  }
  return column;
}

function cellsFor(line: PdfLine, header: Header): Partial<Record<Column, string>> {
  const cells: Partial<Record<Column, string>> = {};
  for (const item of line.items) {
    const column = columnFor(item.x, header.anchors);
    cells[column] = [cells[column], item.text.trim()].filter(Boolean).join(' ');
  }
  return cells;
}

function isSummary(line: PdfLine) {
  return /\b(?:opening|beginning|closing|ending)\s+balance\b|\btotal\s+(?:debits?|credits?)\b|\b(?:subtotal|page\s+total)\b/i.test(line.text);
}

export function parseTransactions(items: PdfTextItem[], creditCard = false): ParseResult {
  const lines = groupIntoLines(items);
  const inferredHeaders = inferHeaders(lines);
  const transactions: ParsedTransaction[] = [];
  const issues: string[] = [];
  let unparsedRows = 0;
  let header: Header | null = null;
  let currentPage = 0;
  let candidateRows = 0;
  let labeled = false;
  let inferred = false;
  let section = 0;
  const datedRows: Array<{line: PdfLine; cells: Partial<Record<Column, string>>; date: string; header: Header; section: number}> = [];
  const descriptionLines: Array<{line: PdfLine; text: string; section: number}> = [];
  const rejectionReasons = {date: 0, description: 0, amount: 0, direction: 0};
  for (const line of lines) {
    if (line.page !== currentPage) { header = inferredHeaders.get(line.page) ?? null; currentPage = line.page; section++; }
    const detected = detectHeader(line);
    if (detected) { header = detected; labeled = true; section++; continue; }
    if (header?.inferred && line.y > header.y) continue;
    if (!header) continue;
    if (isSummary(line)) { section++; continue; }
    if (header.inferred) inferred = true;
    if (/\b(?:summary|important information)\b/i.test(line.text)) { header = null; section++; continue; }
    const cells = cellsFor(line, header);
    const date = parseStatementDate((cells.date ?? '').split('|')[0]!);
    if (date) {
      candidateRows++;
      datedRows.push({line, cells, date, header, section});
      continue;
    }
    const hasMoney = ['debit', 'credit', 'amount', 'balance'].some((column) => parseAmountMinor(cells[column as Column] ?? '') !== null);
    if (hasMoney) {
      unparsedRows++;
      rejectionReasons.date++;
      issues.push(`Page ${line.page}: a row with an amount has no reliable date.`);
    } else if (cells.description && !cells.date) {
      descriptionLines.push({line, text: cells.description, section});
    }
  }

  const fragments = new Map<PdfLine, Array<{y: number; text: string; items: PdfTextItem[]}>>();
  for (const fragment of descriptionLines) {
    const nearby = datedRows
      .filter((row) => row.section === fragment.section && row.line.page === fragment.line.page)
      .sort((a, b) => Math.abs(a.line.y - fragment.line.y) - Math.abs(b.line.y - fragment.line.y))[0];
    if (!nearby || Math.abs(nearby.line.y - fragment.line.y) > 18) continue;
    fragments.set(nearby.line, [...(fragments.get(nearby.line) ?? []), {y: fragment.line.y, text: fragment.text, items: fragment.line.items}]);
  }

  for (const {line, cells, date, header} of datedRows) {
    const pieces = [
      ...(cells.description ? [{y: line.y, text: cells.description, items: line.items}] : []),
      ...(fragments.get(line) ?? []),
    ].sort((a, b) => b.y - a.y);
    const description = pieces.map(({text}) => text.trim()).filter(Boolean).join(' ');
    const parsedDebit = parseAmountMinor(cells.debit ?? '');
    const parsedCredit = parseAmountMinor(cells.credit ?? '');
    // Statements often print 0.00 in the unused side of a debit/credit pair.
    const debit = parsedDebit === 0 ? null : parsedDebit;
    const credit = parsedCredit === 0 ? null : parsedCredit;
    const amount = parseAmountMinor(cells.amount ?? '');
    const balance = parseAmountMinor(cells.balance ?? '');
    if (!description || (debit === null && credit === null && amount === null) || (debit !== null && credit !== null)) {
      unparsedRows++;
      if (!description) rejectionReasons.description++;
      else rejectionReasons.amount++;
      issues.push(`Page ${line.page}: a dated row has ambiguous description or amount.`);
      continue;
    }
    const value = debit ?? credit ?? amount!;
    if (value === 0) {
      unparsedRows++;
      rejectionReasons.amount++;
      issues.push(`Page ${line.page}: a zero-amount row was left for review.`);
      continue;
    }
    const amountText = cells.amount ?? '';
    const markedCredit = /\b(?:CR|CREDIT)\b/i.test(amountText);
    const markedDebit = /\b(?:DR|DEBIT)\b/i.test(amountText);
    const directionAmbiguous = header.inferred && amount !== null && !markedCredit && !markedDebit && amount > 0 && !/^\s*\+/.test(amountText) && !creditCard;
    const explicitPlus = /^\s*\+/.test(amountText);
    const creditRow = credit !== null || (amount !== null && (markedCredit || (!markedDebit && (creditCard ? amount < 0 || explicitPlus : amount > 0))));
    const row: ParsedTransaction = {
      date,
      description,
      amountMinor: Math.abs(value),
      kind: creditRow ? 'income' : 'expense',
      balanceMinor: balance ?? undefined,
      sourcePage: line.page,
      confidence: header.inferred || (amount !== null && debit === null && credit === null) ? 0.55 : pieces.length > 1 ? 0.78 : 0.95,
      sourceItems: [...new Set(pieces.flatMap(({items}) => items))],
      directionAmbiguous,
    };
    transactions.push(row);
  }
  const reconciliation = reconcileStatement(lines, transactions, creditCard);
  if (unparsedRows > 0 && reconciliation.status !== 'failed') {
    reconciliation.status = 'warning';
    reconciliation.issues.push(`${unparsedRows} transaction-like rows could not be staged.`);
  }
  const usableText = items.reduce((count, item) => count + item.text.trim().length, 0) >= 30;
  const status = !usableText ? 'no_text_layer' : !labeled && !inferred ? 'no_transaction_table' : !transactions.length && unparsedRows ? 'candidate_rows_rejected' : 'rows_found';
  return {transactions, reconciliation, unparsedRows, issues, diagnostics: {status, candidateRows, rejectedRows: unparsedRows, detection: labeled ? 'labeled' : inferred ? 'inferred' : 'none', rejectionReasons}};
}
