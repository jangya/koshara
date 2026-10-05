import {describe, expect, it} from 'vitest';
import {addDashboardWidget, configureDashboardWidget, moveDashboardWidget, removeDashboardWidget, resizeDashboardWidget} from './dashboard-tools';
import type {DashboardDefinition} from './dashboard-definition';

const empty: DashboardDefinition = {id: 'dashboard', name: 'Overview', widgets: []};

describe('dashboard composition tools', () => {
  it('builds a row with income beside spending and transactions underneath', () => {
    const spending = addDashboardWidget(empty, 'spending', 'none', 'none', 'spending');
    const income = addDashboardWidget(spending, 'income', 'beside', 'spending', 'income');
    const transactions = addDashboardWidget(income, 'recent_transactions', 'below', 'income', 'transactions');
    expect(transactions.widgets.map(({type, layout}) => [type, layout.colSpan, layout.order])).toEqual([
      ['spending', 6, 0], ['income', 6, 1], ['recent_transactions', 12, 2],
    ]);
    expect(transactions.widgets[2]?.layout.newRow).toBe(true);
    expect(empty.widgets).toEqual([]);
  });

  it('reorders, resizes, configures and removes only the draft', () => {
    const first = addDashboardWidget(empty, 'spending', 'none', 'none', 'spending');
    const second = addDashboardWidget(first, 'recent_transactions', 'none', 'none', 'transactions');
    const moved = moveDashboardWidget(second, 'transactions', 'top', 'none');
    const resized = resizeDashboardWidget(moved, 'transactions', 'full');
    const configured = configureDashboardWidget(resized, 'transactions', {accountId: 'hdfc-savings', sort: 'amount_desc'});
    const removed = removeDashboardWidget(configured, 'spending');
    expect(removed.widgets).toMatchObject([{id: 'transactions', layout: {colSpan: 12, order: 0}, config: {accountId: 'hdfc-savings', sort: 'amount_desc'}}]);
    expect(second.widgets.map(({id}) => id)).toEqual(['spending', 'transactions']);
  });
});
