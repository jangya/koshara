import type {DateRange} from '@astryxdesign/core/DateRangeInput';
import {isValidIsoDate} from './date-range';
import type {DashboardWidgetType} from './dashboard-widget-catalog';
export type {DashboardWidgetType} from './dashboard-widget-catalog';

export type Placement = 'before' | 'after' | 'beside' | 'above' | 'below' | 'top' | 'none';
export type WidgetSize = 'small' | 'medium' | 'large' | 'full' | 'unchanged';
export interface DashboardWidgetConfig {
  search?: string;
  accountId?: string;
  categoryId?: string;
  categoryIds?: string[];
  dateRange?: DateRange;
  sort?: 'date_desc' | 'amount_desc' | 'amount_asc';
  transactionType?: 'all' | 'expense' | 'income';
}
export interface DashboardWidgetInstance {
  id: string;
  type: DashboardWidgetType;
  config: DashboardWidgetConfig;
  layout: {colSpan: number; order: number; newRow?: boolean};
}
export interface DashboardDefinition {
  id: string;
  name: string;
  widgets: DashboardWidgetInstance[];
}
export const DASHBOARD_WIDGET_TYPES = ['spending', 'income', 'recent_transactions', 'cashflow', 'accounts', 'budget', 'category_spending'] as const;
const spans = [4, 6, 8, 12];
export function isDashboardWidgetType(value: unknown): value is DashboardWidgetType {
  return typeof value === 'string' && DASHBOARD_WIDGET_TYPES.some((type) => type === value);
}
export function validateDashboardDefinition(value: unknown): value is DashboardDefinition {
  if (!value || typeof value !== 'object') return false;
  const dashboard = value as Partial<DashboardDefinition>;
  if (typeof dashboard.id !== 'string' || !dashboard.id || typeof dashboard.name !== 'string' || dashboard.name.length > 80 || !Array.isArray(dashboard.widgets) || dashboard.widgets.length > 30) return false;
  const ids = new Set<string>();
  return dashboard.widgets.every((widget) => {
    if (!widget || typeof widget.id !== 'string' || !widget.id || ids.has(widget.id) || !isDashboardWidgetType(widget.type)
      || !widget.layout || !spans.includes(widget.layout.colSpan) || !Number.isInteger(widget.layout.order)
      || (widget.layout.newRow !== undefined && typeof widget.layout.newRow !== 'boolean')
      || !widget.config || typeof widget.config !== 'object') return false;
    ids.add(widget.id);
    const config = widget.config;
    return (config.search === undefined || typeof config.search === 'string')
      && (config.accountId === undefined || typeof config.accountId === 'string')
      && (config.categoryId === undefined || typeof config.categoryId === 'string')
      && (config.categoryIds === undefined || Array.isArray(config.categoryIds) && config.categoryIds.every((id) => typeof id === 'string'))
      && (config.sort === undefined || ['date_desc', 'amount_desc', 'amount_asc'].includes(config.sort))
      && (config.transactionType === undefined || ['all', 'expense', 'income'].includes(config.transactionType))
      && (config.dateRange === undefined || isValidIsoDate(config.dateRange.start) && isValidIsoDate(config.dateRange.end) && config.dateRange.start <= config.dateRange.end);
  });
}

const STORAGE_KEY = 'koshara-dashboard-definitions:v1';
export function loadDashboards(): DashboardDefinition[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter(validateDashboardDefinition) : [];
  } catch { return []; }
}
export function saveDashboards(dashboards: DashboardDefinition[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards));
}
