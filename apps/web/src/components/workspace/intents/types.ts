export type WorkspaceIntent =
  | 'add_expense'
  | 'add_account'
  | 'add_category'
  | 'import_statement'
  | 'show_widget'
  | 'build_dashboard'
  | 'show_accounts'
  | 'show_expenses'
  | 'show_transactions'
  | 'unknown';

export interface WorkspaceDecision {
  intent: WorkspaceIntent;
  input: string;
}

export interface WorkspaceSurfaceProps {
  input: string;
  onComplete: (result?: WorkspaceResult) => void;
}

export interface WorkspaceResult {
  title: string;
  detail?: string;
}
