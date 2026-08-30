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

export async function copyPrompt(prompt: string, writeText: (value: string) => Promise<void> = (value) => navigator.clipboard.writeText(value)) {
  await writeText(prompt);
}
