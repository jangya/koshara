import {describe, expect, it} from 'vitest';

import {classifyWorkspaceIntent} from './classify-intent';

describe('Workspace intent classifier', () => {
  it.each([
    ['Add an expense', 'add_expense'],
    ['Add an account', 'add_account'],
    ['Create a category', 'add_category'],
    ['Upload my statement', 'import_statement'],
    ['Show cash flow', 'show_widget'],
    ['Show my spending summary over the last year', 'show_widget'],
    ['Show income and spending', 'show_widget'],
    ['Build my dashboard', 'build_dashboard'],
    ['Show accounts', 'show_accounts'],
    ['Check expenses', 'show_expenses'],
    ['Check transactions', 'show_transactions'],
    ['Spend 500 rupees on dining yesterday', 'add_expense'],
    ['Tell me a joke', 'unknown'],
  ] as const)('classifies %s as %s', async (input, intent) => {
    await expect(classifyWorkspaceIntent(input)).resolves.toEqual({intent, input});
  });
});
