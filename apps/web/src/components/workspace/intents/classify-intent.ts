import type {WorkspaceDecision, WorkspaceIntent} from './types';

// Replace this classifier with a server endpoint backed by the shared JEV client.
// The endpoint should return only a validated WorkspaceIntent; the registry owns UI.
export async function classifyWorkspaceIntent(input: string): Promise<WorkspaceDecision> {
  const text = input.trim().toLocaleLowerCase();
  let intent: WorkspaceIntent = 'unknown';
  if (/(statement|pdf)/.test(text) && /(import|upload|add|read|statement|pdf)/.test(text)) intent = 'import_statement';
  else if (/(dashboard)/.test(text) && /(build|create|make|set up|customize)/.test(text)) intent = 'build_dashboard';
  else if (/(show|check|view|list|see)/.test(text) && /accounts?/.test(text)) intent = 'show_accounts';
  else if (/(show|check|view|list|see)/.test(text) && /expenses?/.test(text) && !/(summary|chart|widget|by category)/.test(text)) intent = 'show_expenses';
  else if (/(show|check|view|list|see)/.test(text) && /transactions?/.test(text) && !/recent transactions?/.test(text)) intent = 'show_transactions';
  else if (/(show|view|display|add)/.test(text) && /(cash.?flow|widget|recent transactions|spending|income|summary|chart)/.test(text)) intent = 'show_widget';
  else if (/(\b(add|create|record|log|new)\b.*\b(expense|spend|spent|purchase|payment)\b|\b(spend|spent|paid)\b)/.test(text)) intent = 'add_expense';
  else if (/(add|create|new|open)/.test(text) && /(account|bank|wallet)/.test(text)) intent = 'add_account';
  else if (/(add|create|new)/.test(text) && /(category|budget category)/.test(text)) intent = 'add_category';
  return {intent, input: input.trim()};
}
