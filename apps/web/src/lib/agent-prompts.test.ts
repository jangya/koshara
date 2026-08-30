import {describe, expect, it} from 'vitest';

import {buildCategoryPrompts, buildDashboardPrompts, buildTransactionPrompts, copyPrompt} from './agent-prompts';

describe('external AI-agent prompt suggestions', () => {
  it('includes the exact dashboard period', () => {
    expect(buildDashboardPrompts('1–30 August 2026', 3)).toContain('Compare my spending from 1–30 August 2026 with the previous period.');
    expect(buildDashboardPrompts('1–30 August 2026', 3)).toContain('Show the 3 transactions that may need my attention from 1–30 August 2026.');
  });

  it('reflects current filters and selection count in transaction prompts', () => {
    const prompts = buildTransactionPrompts({period: '1–30 August 2026', visibleCount: 12, needsReviewCount: 2, selectedCount: 4, filterSummary: 'Dining · Expenses'});
    expect(prompts).toContain('Categorize the 4 selected transactions.');
    expect(prompts).toContain('Summarize the 12 transactions shown for 1–30 August 2026 with filters: Dining · Expenses.');
  });

  it('uses a real category name for category budgeting prompts', () => {
    expect(buildCategoryPrompts('Dining')).toContain('Suggest a realistic monthly limit for Dining.');
  });

  it('copies exactly the visible prompt without hidden instructions', async () => {
    const copied: string[] = [];
    await copyPrompt('Visible prompt only.', async (value) => { copied.push(value); });
    expect(copied).toEqual(['Visible prompt only.']);
  });
});
