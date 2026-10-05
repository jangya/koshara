import 'server-only';
import {askJevChoices, validatedChoice} from './jev-client';
import {type DashboardWidgetType} from '../dashboard-definition';
import type {DashboardDecision} from '../dashboard-tools';

const widgetCriteria: Record<DashboardWidgetType | 'none', string> = {
  spending: 'Monthly spending total or expenses summary', income: 'Monthly income or earnings total',
  recent_transactions: 'Recent transactions, transaction list, or transaction filtering', cashflow: 'Cash flow chart or income versus spending trend',
  accounts: 'Account balances or account list', budget: 'Budget status or limits', category_spending: 'Spending broken down by category',
  none: 'No widget can be identified',
};
const actionCriteria = {
  add_widget: 'Add or show a new known widget', remove_widget: 'Remove an existing widget',
  move_widget: 'Move or reorder an existing widget', resize_widget: 'Change width or size of an existing widget',
  configure_widget: 'Filter, sort, search, or change the data shown inside an existing widget', none: 'No supported dashboard modification',
};
export async function classifyDashboardCommand(input: string, widgets: Array<{id: string; type: DashboardWidgetType; title: string}>, accounts: Array<{id: string; name: string}>, categories: Array<{id: string; name: string}>, lastActiveWidgetId: string | null): Promise<DashboardDecision | null> {
  const widgetIds = Object.keys(widgetCriteria);
  const targetCriteria = Object.fromEntries([...widgets.map(({id, type, title}) => [id, `${title} (${type}); use only when this existing instance is the subject or explicitly named anchor`]), ['none', 'No reliable existing widget reference']]);
  const answers = await askJevChoices({input, widgets, accounts, categories, lastActiveWidgetId}, {
    action: {type: 'choice', instructions: 'Classify the requested dashboard modification. Select only one operation.', criteria: actionCriteria},
    widget: {type: 'choice', instructions: 'Select the known widget type requested. Never invent a type. For changes to an existing widget, select its type.', criteria: widgetCriteria},
    target: {type: 'choice', instructions: 'Select the existing widget being removed, moved, resized, or configured. Resolve it/this to lastActiveWidgetId only when context makes that clear. For add, choose none.', criteria: targetCriteria},
    anchor: {type: 'choice', instructions: 'Select the existing widget used as a relative placement anchor. Resolve it/this from context when clear; otherwise none.', criteria: targetCriteria},
    placement: {type: 'choice', instructions: 'Choose requested relative placement. Top means first widget. None means no relative placement.', criteria: {before: 'Immediately before anchor', after: 'Immediately after anchor', beside: 'Beside anchor on same row if spans fit', above: 'Above anchor', below: 'Below anchor', top: 'First widget at top', none: 'No placement specified'}},
    size: {type: 'choice', instructions: 'Choose requested width only when explicitly specified.', criteria: {small: 'Small width', medium: 'Medium width', large: 'Large width', full: 'Full row or full width', unchanged: 'No size change requested'}},
    account: {type: 'choice', instructions: 'Select an account only if user explicitly requests this account as a transaction filter.', criteria: Object.fromEntries([...accounts.map(({id, name}) => [id, name]), ['none', 'No account filter requested']])},
    category: {type: 'choice', instructions: 'Select a category only if user explicitly requests this category as a transaction filter. Food means groceries and dining if no category named Food exists.', criteria: Object.fromEntries([...categories.map(({id, name}) => [id, name]), ['food', 'Food purchases, including groceries and dining'], ['none', 'No category filter requested']])},
    dateRange: {type: 'choice', instructions: 'Select a requested transaction date filter.', criteria: {last_month: 'Last calendar month', this_month: 'Current calendar month', unchanged: 'No date filter requested'}},
    sort: {type: 'choice', instructions: 'Select a requested transaction sort order.', criteria: {date_desc: 'Newest first', amount_desc: 'Highest amount first', amount_asc: 'Lowest amount first', unchanged: 'No sorting requested'}},
    transactionType: {type: 'choice', instructions: 'Select a requested transaction type filter.', criteria: {expense: 'Expenses only', income: 'Income only', all: 'All types explicitly requested', unchanged: 'No type filter requested'}},
  });
  if (!answers) return null;
  const choice = (key: string, allowed: string[]) => validatedChoice(answers[key], allowed);
  const action = choice('action', Object.keys(actionCriteria));
  const widget = choice('widget', widgetIds);
  const targetId = choice('target', Object.keys(targetCriteria));
  const anchorId = choice('anchor', Object.keys(targetCriteria));
  const placement = choice('placement', ['before', 'after', 'beside', 'above', 'below', 'top', 'none']);
  const size = choice('size', ['small', 'medium', 'large', 'full', 'unchanged']);
  const accountId = choice('account', [...accounts.map(({id}) => id), 'none']);
  const categoryId = choice('category', [...categories.map(({id}) => id), 'food', 'none']);
  const dateRange = choice('dateRange', ['last_month', 'this_month', 'unchanged']);
  const sort = choice('sort', ['date_desc', 'amount_desc', 'amount_asc', 'unchanged']);
  const transactionType = choice('transactionType', ['all', 'expense', 'income', 'unchanged']);
  if (!action || (action === 'add_widget' && (!widget || widget === 'none'))) return null;
  return {
    action, widget: widget ?? 'none', targetId: targetId ?? 'none', anchorId: anchorId ?? 'none',
    placement: placement ?? 'none', size: size ?? 'unchanged', accountId: accountId ?? 'none',
    categoryId: categoryId ?? 'none', dateRange: dateRange ?? 'unchanged',
    sort: sort ?? 'unchanged', transactionType: transactionType ?? 'unchanged',
  } as DashboardDecision;
}
