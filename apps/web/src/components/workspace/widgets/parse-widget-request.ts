import type {DateRange} from '@astryxdesign/core/DateRangeInput';

import {getDateRangePreset, toLocalIsoDate} from '../../../lib/date-range';
import type {Category} from '@/lib/koshara-types';
import type {WorkspaceWidgetType} from '@/components/finance-widgets/registry';

export interface WorkspaceWidgetRequest {
  widgets: WorkspaceWidgetType[];
  range: DateRange;
  categoryIds?: string[];
}

// A bounded parser selects widget IDs and dates. The registry owns every rendered component.
export function parseWidgetRequest(input: string, now = new Date(), categories: Category[] = []): WorkspaceWidgetRequest {
  const text = input.toLocaleLowerCase();
  let range: DateRange;
  if (/\b(last|past|previous)\s+(year|12\s+months)\b/.test(text)) {
    range = {start: toLocalIsoDate(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1, 12)), end: toLocalIsoDate(now)};
  } else if (/\b(this year|year to date|ytd)\b/.test(text)) {
    range = getDateRangePreset('year-to-date', now);
  } else if (/\b(last|past|previous)\s+(6|six)\s+months\b/.test(text)) {
    range = getDateRangePreset('last-6-months', now);
  } else if (/\b(last|past|previous)\s+(3|three)\s+months\b/.test(text)) {
    range = getDateRangePreset('last-3-months', now);
  } else if (/\blast month\b/.test(text)) {
    range = getDateRangePreset('last-month', now);
  } else if (/\bthis month\b/.test(text)) {
    range = getDateRangePreset('this-month', now);
  } else {
    range = getDateRangePreset('last-3-months', now);
  }

  let widgets: WorkspaceWidgetType[];
  const income = /\b(income|earnings|salary)\b/.test(text);
  const spending = /\b(spending|expenses?|spent)\b/.test(text);
  if (/\brecent transactions?\b/.test(text)) widgets = ['recent_transactions'];
  else if (income && spending) widgets = ['income', 'spending', 'cashflow'];
  else if (/\bcash\s?flow\b/.test(text)) widgets = ['cashflow'];
  else if (/\b(category|categories|breakdown)\b/.test(text)) widgets = ['spending', 'category_spending'];
  else if (spending && /\b(summary|overview)\b/.test(text)) widgets = ['spending', 'category_spending', 'cashflow'];
  else if (spending) widgets = ['spending', 'category_spending'];
  else if (income) widgets = ['income', 'cashflow'];
  else widgets = ['income', 'spending', 'cashflow'];
  let categoryIds: string[] | undefined;
  if (/\b(?:only|just|limited to)\b/.test(text) && /\b(?:spending|expenses?|spent)\b/.test(text)) {
    const normalizedInput = ` ${text.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
    const matches = categories.filter(({name}) => normalizedInput.includes(` ${name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `));
    const selected = new Set(matches.map(({id}) => id));
    // In the demo data, Food is represented by Groceries and Dining unless a Food category exists.
    if (/\bfood\b/.test(text) && !matches.some(({name}) => name.toLocaleLowerCase() === 'food')) {
      categories.filter(({name}) => /^(groceries|dining)$/i.test(name)).forEach(({id}) => selected.add(id));
    }
    categoryIds = [...selected];
  }
  return {widgets, range, ...(categoryIds === undefined ? {} : {categoryIds})};
}
