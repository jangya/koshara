import {parseAmountMinor} from './amount';
import type {ParsedTransaction, PdfLine, ReconciliationResult} from './types';

function labeledAmount(lines: PdfLine[], labels: RegExp): number | undefined {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    // A transaction-table heading is not a statement closing balance.
    if (/\b(?:txn|transaction|posting|posted|value)?\s*date\b/i.test(line.text)
      && /\b(?:narration|description|particulars|withdrawals?|deposits?|amount)\b/i.test(line.text)) continue;
    const label = line.items.find((item) => labels.test(item.text));
    if (!label) continue;
    const match = label.text.match(labels)!;
    const tail = label.text.slice(match.index! + match[0].length);
    const amounts = tail.match(/(?:₹\s*)?[-(]?\d[\d,]*(?:\.\d{1,2})?\)?/g);
    const embedded = amounts?.length ? parseAmountMinor(amounts.at(-1)!) : null;
    if (embedded !== null && embedded !== undefined) return embedded;
    const nextLabelX = line.items.find((item) => item.x > label.x && /\b(?:limit|(?:debit|credit)\s+amount|(?:closing|opening)\s+balance)\b/i.test(item.text))?.x ?? Infinity;
    const inline = line.items.find((item) => item.x > label.x && item.x < nextLabelX && parseAmountMinor(item.text) !== null);
    if (inline) return parseAmountMinor(inline.text) ?? undefined;
    // Summary cards can put a subheading between the label and its value.
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex++) {
      const next = lines[nextIndex]!;
      if (next.page !== line.page || line.y - next.y > 35) break;
      const adjacent = next.items.find((item) => Math.abs(item.x - label.x) <= 40 && parseAmountMinor(item.text) !== null);
      if (adjacent) return parseAmountMinor(adjacent.text) ?? undefined;
    }
  }
  return undefined;
}

export function reconcileStatement(lines: PdfLine[], transactions: ParsedTransaction[], creditCard = false): ReconciliationResult {
  const openingBalanceMinor = labeledAmount(lines, creditCard ? /\b(?:opening|beginning)\s+balance\b|\bprevious\s+statement\s+dues\b/i : /\b(?:opening|beginning)\s+balance\b/i);
  const closingBalanceMinor = labeledAmount(lines, creditCard ? /\b(?:closing|ending)\s+balance\b|\btotal\s+amount\s+due\b/i : /\b(?:closing|ending)\s+balance\b/i);
  const statedDebitsMinor = labeledAmount(lines, creditCard ? /\btotal\s+debits?\b|\bpurchases\s*\/\s*debits?\b|\bdebit\s+amount\b/i : /\btotal\s+debits?\b|\bdebit\s+amount\b/i);
  const statedCreditsMinor = labeledAmount(lines, creditCard ? /\btotal\s+credits?\b(?!\s+limit)|\bpayments\s*\/\s*credits?\b|\bcredit\s+amount\b/i : /\btotal\s+credits?\b(?!\s+limit)|\bcredit\s+amount\b/i);
  const extractedDebitsMinor = transactions.filter(({kind}) => kind === 'expense').reduce((sum, row) => sum + row.amountMinor, 0);
  const extractedCreditsMinor = transactions.filter(({kind}) => kind === 'income').reduce((sum, row) => sum + row.amountMinor, 0);
  const issues: string[] = [];
  let differenceMinor: number | undefined;
  const toleranceMinor = 1;
  if (openingBalanceMinor !== undefined && closingBalanceMinor !== undefined) {
    differenceMinor = openingBalanceMinor + (creditCard ? extractedDebitsMinor - extractedCreditsMinor : extractedCreditsMinor - extractedDebitsMinor) - closingBalanceMinor;
    if (Math.abs(differenceMinor) > toleranceMinor) issues.push('Transaction totals do not reach the stated closing balance.');
  }
  if (statedDebitsMinor !== undefined && Math.abs(statedDebitsMinor - extractedDebitsMinor) > toleranceMinor) {
    issues.push('Extracted debits differ from the statement total.');
  }
  if (statedCreditsMinor !== undefined && Math.abs(statedCreditsMinor - extractedCreditsMinor) > toleranceMinor) {
    issues.push('Extracted credits differ from the statement total.');
  }
  let previousBalance = openingBalanceMinor;
  for (const row of transactions) {
    if (row.balanceMinor !== undefined && previousBalance !== undefined) {
      const expected = previousBalance + (creditCard ? row.kind === 'expense' ? row.amountMinor : -row.amountMinor : row.kind === 'income' ? row.amountMinor : -row.amountMinor);
      if (Math.abs(expected - row.balanceMinor) > toleranceMinor) {
        issues.push(`Page ${row.sourcePage}: a running balance does not match the reconstructed row.`);
      }
    }
    if (row.balanceMinor !== undefined) previousBalance = row.balanceMinor;
  }
  const hasReference = differenceMinor !== undefined || statedDebitsMinor !== undefined || statedCreditsMinor !== undefined;
  return {
    status: issues.length ? 'failed' : hasReference ? 'passed' : 'unavailable',
    openingBalanceMinor,
    closingBalanceMinor,
    extractedDebitsMinor,
    extractedCreditsMinor,
    statedDebitsMinor,
    statedCreditsMinor,
    differenceMinor,
    issues,
    balanceConvention: creditCard ? 'credit-card' : 'bank',
  };
}
