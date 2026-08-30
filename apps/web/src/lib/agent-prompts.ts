export function buildDashboardPrompts(period: string, needsReviewCount: number) {
  return [
    `Compare my spending from ${period} with the previous period.`,
    `Where can I realistically save money based on ${period}?`,
    `Which categories are close to their monthly limits in ${period}?`,
    `Explain the largest changes in my spending for ${period}.`,
    needsReviewCount > 0
      ? `Show the ${needsReviewCount} transactions that may need my attention from ${period}.`
      : `Show transactions that may need my attention from ${period}.`,
  ];
}

export function buildTransactionPrompts({
  period,
  visibleCount,
  needsReviewCount,
  selectedCount,
  filterSummary,
}: {
  period: string;
  visibleCount: number;
  needsReviewCount: number;
  selectedCount: number;
  filterSummary: string;
}) {
  return [
    needsReviewCount > 0
      ? `Review my ${needsReviewCount} uncertain transactions from ${period}.`
      : `Check whether any of my transactions from ${period} need review.`,
    `Check the ${visibleCount} current transactions from ${period} for possible duplicates.`,
    `Find recurring subscriptions in ${period}.`,
    selectedCount > 0 ? `Categorize the ${selectedCount} selected transactions.` : `Help me choose categories for the transactions shown from ${period}.`,
    `Summarize the ${visibleCount} transactions shown for ${period} with filters: ${filterSummary}.`,
  ];
}

export function buildCategoryPrompts(categoryName: string, period?: string) {
  return [
    `Suggest a realistic monthly limit for ${categoryName}.`,
    `Which category budgets should I adjust${period ? ` based on ${period}` : ''}?`,
    `Show categories where spending is increasing${period ? ` through ${period}` : ''}.`,
    `Compare actual spending${period ? ` from ${period}` : ''} with my category limits.`,
  ];
}

export const STATEMENT_IMPORT_PROMPT = 'Import the attached statement into Koshara using the WebMCP tools available on the Statements page. Use existing accounts and categories. Prepare the transactions for review, identify possible duplicates, group related statement rows where appropriate, and do not add anything to my Transactions until I approve the import.';

export function getPageAgentPrompts(pathname: string) {
  if (pathname === '/dashboard') {
    return [
      'Summarize my spending this month and show the categories with the largest changes.',
      'Which recent transactions may need my attention?',
    ];
  }
  if (pathname === '/transactions' || pathname.startsWith('/transactions/')) {
    return [
      'Add a ₹500 dining expense from today to my primary card.',
      'Find possible duplicate transactions from this month.',
    ];
  }
  if (pathname === '/accounts' || pathname.startsWith('/accounts/')) {
    return ['List my Koshara accounts and their current balances.'];
  }
  if (pathname === '/categories' || pathname.startsWith('/categories/')) {
    return [
      'Which categories are closest to their monthly limits?',
      'Suggest a realistic monthly limit for Dining.',
    ];
  }
  if (pathname === '/statements' || pathname.startsWith('/statements/')) return [STATEMENT_IMPORT_PROMPT];
  return [];
}

export async function copyPrompt(prompt: string, writeText: (value: string) => Promise<void> = (value) => navigator.clipboard.writeText(value)) {
  await writeText(prompt);
}
