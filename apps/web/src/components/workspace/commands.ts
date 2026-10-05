import {workspaceRegistry} from './intents/registry';
import {workspaceWidgetRegistry} from '@/components/finance-widgets/registry';

export interface WorkspaceCommand {
  group: 'Actions' | 'Views' | 'Widgets';
  label: string;
  slash: string;
  prompt: string;
}

// Slash help points to known capabilities; selecting one fills the composer.
export const workspaceCommands: WorkspaceCommand[] = [
  {group: 'Actions', label: workspaceRegistry.add_expense.title, slash: '/expense', prompt: 'Add an expense'},
  {group: 'Actions', label: workspaceRegistry.add_account.title, slash: '/account', prompt: 'Add an account'},
  {group: 'Actions', label: workspaceRegistry.add_category.title, slash: '/category', prompt: 'Add a category'},
  {group: 'Actions', label: workspaceRegistry.import_statement.title, slash: '/statement', prompt: 'Import a statement'},
  {group: 'Actions', label: workspaceRegistry.build_dashboard.title, slash: '/dashboard', prompt: 'Build my dashboard'},
  {group: 'Views', label: workspaceRegistry.show_accounts.title, slash: '/accounts', prompt: 'Show accounts'},
  {group: 'Views', label: workspaceRegistry.show_expenses.title, slash: '/expenses', prompt: 'Check expenses'},
  {group: 'Views', label: workspaceRegistry.show_transactions.title, slash: '/transactions', prompt: 'Check transactions'},
  {group: 'Widgets', label: workspaceWidgetRegistry.income.title, slash: '/income', prompt: 'Show income'},
  {group: 'Widgets', label: workspaceWidgetRegistry.spending.title, slash: '/spending', prompt: 'Show spending summary'},
  {group: 'Widgets', label: workspaceWidgetRegistry.cashflow.title, slash: '/cashflow', prompt: 'Show cash flow'},
  {group: 'Widgets', label: workspaceWidgetRegistry.category_spending.title, slash: '/category-spending', prompt: 'Show spending by category'},
  {group: 'Widgets', label: workspaceWidgetRegistry.recent_transactions.title, slash: '/recent-transactions', prompt: 'Show recent transactions'},
  {group: 'Widgets', label: 'Income and spending', slash: '/income-spending', prompt: 'Show income and spending'},
  {group: 'Widgets', label: 'Spending over the last year', slash: '/spending-year', prompt: 'Show my spending summary over the last year'},
];
