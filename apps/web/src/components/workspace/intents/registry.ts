import type {ComponentType} from 'react';
import {AccountSurface, AccountsSurface, CategorySurface, DashboardBuilderSurface, ExpenseSurface, ExpensesSurface, StatementSurface, TransactionsSurface, WidgetSurface} from '../surfaces';
import type {WorkspaceIntent, WorkspaceSurfaceProps} from './types';

interface WorkspaceRegistration {
  title: string;
  component: ComponentType<WorkspaceSurfaceProps>;
  // Parsers and actions can be added per capability without changing WorkspacePage.
  parse?: (input: string) => unknown;
}

// Only these registered Kosara surfaces may render for a classified intent.
export const workspaceRegistry = {
  add_expense: {title: 'Add expense', component: ExpenseSurface},
  add_account: {title: 'Add account', component: AccountSurface},
  add_category: {title: 'Add category', component: CategorySurface},
  import_statement: {title: 'Import statement', component: StatementSurface},
  show_widget: {title: 'Show widget', component: WidgetSurface},
  build_dashboard: {title: 'Build dashboard', component: DashboardBuilderSurface},
  show_accounts: {title: 'Accounts', component: AccountsSurface},
  show_expenses: {title: 'Expenses', component: ExpensesSurface},
  show_transactions: {title: 'Transactions', component: TransactionsSurface},
} satisfies Record<Exclude<WorkspaceIntent, 'unknown'>, WorkspaceRegistration>;
