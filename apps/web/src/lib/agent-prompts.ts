import {formatMinorCurrencySummary} from './format';

export const CASHFLOW_CHART_DEMO_PROMPT = 'Analyze why my spending increased over the last three months. Update the dashboard chart to show the most useful comparison, highlight the dates and categories responsible, and explain what you found.';

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

interface DataDrivenDashboardPromptContext {
  period: string;
  uncategorizedCount: number;
  needsReviewCount: number;
  overBudgetCategory?: {name: string; budgetLimitMinor: number};
  increasingCategoryName?: string;
  possibleDuplicateCount?: number;
}

export function buildDataDrivenDashboardPrompts(context: DataDrivenDashboardPromptContext) {
  const prompts = [CASHFLOW_CHART_DEMO_PROMPT, `Compare my spending from ${context.period} with the previous period.`];
  if (context.uncategorizedCount > 0) prompts.push(`Categorize my ${context.uncategorizedCount} uncategorized transactions from ${context.period}.`);
  if (context.needsReviewCount > 0) prompts.push(`Review my ${context.needsReviewCount} needs-review transactions from ${context.period} and explain your classifications.`);
  if (context.overBudgetCategory) {
    prompts.push(`Explain why ${context.overBudgetCategory.name} exceeded its ${formatMinorCurrencySummary(context.overBudgetCategory.budgetLimitMinor, 'INR')} budget for ${context.period}.`);
  }
  if (context.increasingCategoryName) prompts.push(`Why has ${context.increasingCategoryName} spending increased over the last three months?`);
  if ((context.possibleDuplicateCount ?? 0) > 0) prompts.push(`Check my transactions from ${context.period} for possible duplicates.`);
  return prompts;
}

interface DataDrivenCategoryPromptContext extends DataDrivenDashboardPromptContext {
  categoriesWithoutBudgetCount: number;
}

export function buildDataDrivenCategoryPrompts(context: Pick<DataDrivenCategoryPromptContext,
  'period' | 'uncategorizedCount' | 'categoriesWithoutBudgetCount' | 'overBudgetCategory' | 'increasingCategoryName' | 'possibleDuplicateCount'>) {
  const prompts = [`Compare category spending from ${context.period} with the preceding equivalent period.`];
  if (context.uncategorizedCount > 0) prompts.push(`Categorize my ${context.uncategorizedCount} uncategorized transactions from ${context.period}.`);
  if (context.overBudgetCategory) {
    prompts.push(`Explain why ${context.overBudgetCategory.name} exceeded its ${formatMinorCurrencySummary(context.overBudgetCategory.budgetLimitMinor, 'INR')} budget for ${context.period}.`);
  }
  if (context.increasingCategoryName) prompts.push(`Why has ${context.increasingCategoryName} spending increased over the last three months?`);
  if (context.categoriesWithoutBudgetCount > 0) prompts.push(`Suggest monthly budgets using my last six months of spending for the ${context.categoriesWithoutBudgetCount} categories that need a budget.`);
  if ((context.possibleDuplicateCount ?? 0) > 0) prompts.push(`Check my transactions from ${context.period} for possible duplicates.`);
  return prompts;
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
