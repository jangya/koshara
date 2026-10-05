import 'server-only';

import {classifyWorkspaceIntent} from '@/components/workspace/intents/classify-intent';
import type {WorkspaceDecision, WorkspaceIntent} from '@/components/workspace/intents/types';
import type {WorkspaceWidgetType} from '@/components/finance-widgets/registry';
import {askJevChoices, validatedChoice, type JevTrace} from './jev-client';

const intentCriteria = {
  add_expense: 'Create or record a new expense, purchase, payment, or money spent.',
  add_account: 'Create a new bank, cash, wallet, or credit-card account.',
  add_category: 'Create a new spending or income category.',
  import_statement: 'Upload or import a bank statement or PDF.',
  show_widget: 'Show financial metrics, charts, cash flow, income, spending, summaries, or recent transactions as widgets.',
  build_dashboard: 'Build or customize the dashboard layout.',
  show_accounts: 'List, check, or inspect existing accounts.',
  show_expenses: 'List, check, or inspect existing expenses without creating one or requesting a chart.',
  show_transactions: 'List, check, or inspect transactions without creating one or requesting recent-transaction widgets.',
  unknown: 'The request does not match an available Koshara workspace capability.',
} satisfies Record<WorkspaceIntent, string>;

const widgetCapabilities = ['income', 'spending', 'cashflow', 'category_spending', 'recent_transactions'] satisfies WorkspaceWidgetType[];

export interface WorkspaceIntentResponse {
  decision: WorkspaceDecision;
  source: 'jev' | 'deterministic';
  jev?: JevTrace;
  fallbackReason?: string;
}

export async function decideWorkspaceIntent(input: string, debug = false): Promise<WorkspaceIntentResponse> {
  const fallback = await classifyWorkspaceIntent(input);
  let jev: JevTrace | undefined;
  try {
    const answers = await askJevChoices({request: input, availableWidgets: widgetCapabilities}, {
      intent: {
        type: 'choice',
        instructions: 'Choose exactly one available Koshara workspace intent for the request. Choose unknown if none applies. Do not perform the action or generate UI.',
        criteria: intentCriteria,
      },
    }, debug ? (trace) => { jev = trace; } : undefined, AbortSignal.timeout(1800));
    const intent = validatedChoice(answers?.intent, Object.keys(intentCriteria)) as WorkspaceIntent | null;
    if (intent) return {decision: {intent, input}, source: 'jev', ...(debug && jev ? {jev} : {})};
    return {decision: fallback, source: 'deterministic', ...(debug && jev ? {jev} : {}), fallbackReason: 'JEV was unavailable or did not return a valid, confident intent.'};
  } catch (error) {
    return {decision: fallback, source: 'deterministic', ...(debug && jev ? {jev} : {}), fallbackReason: error instanceof Error ? error.message : 'JEV request failed.'};
  }
}
