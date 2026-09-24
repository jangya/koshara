import {describe, expect, it} from 'vitest';

import {parseWidgetRequest} from './parse-widget-request';
import {demoCategories} from '../../../lib/koshara-seed';

describe('parseWidgetRequest', () => {
  it('selects a spending summary set for a rolling year', () => {
    expect(parseWidgetRequest('Show my spending summary over the last year', new Date(2026, 8, 24, 12))).toEqual({
      widgets: ['spending', 'category_spending', 'cashflow'],
      range: {start: '2025-09-25', end: '2026-09-24'},
    });
  });

  it('selects income and spending metrics plus the comparison chart', () => {
    expect(parseWidgetRequest('Show income and spending', new Date(2026, 8, 24, 12)).widgets).toEqual(['income', 'spending', 'cashflow']);
  });

  it('selects a single recent transactions widget', () => {
    expect(parseWidgetRequest('Show recent transactions', new Date(2026, 8, 24, 12)).widgets).toEqual(['recent_transactions']);
  });

  it('limits category spending to Food and Rent using demo category names', () => {
    expect(parseWidgetRequest('Show spending by category only on Food and rent', new Date(2026, 8, 24, 12), demoCategories)).toEqual({
      widgets: ['spending', 'category_spending'],
      range: {start: '2026-07-01', end: '2026-09-24'},
      categoryIds: ['rent', 'groceries', 'dining'],
    });
  });

  it('uses an exact Food category when one exists', () => {
    const categories = [...demoCategories, {...demoCategories[0]!, id: 'food', name: 'Food'}];
    expect(parseWidgetRequest('Show spending by category only on Food and Rent', new Date(2026, 8, 24, 12), categories).categoryIds).toEqual(['rent', 'food']);
  });
});
