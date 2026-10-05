import {dashboardWidgetCatalog} from './dashboard-widget-catalog';
import type {DashboardDefinition, DashboardWidgetConfig, DashboardWidgetInstance, DashboardWidgetType, Placement, WidgetSize} from './dashboard-definition';

export type DashboardAction = 'add_widget' | 'remove_widget' | 'move_widget' | 'resize_widget' | 'configure_widget' | 'none';
export interface DashboardDecision {
  action: DashboardAction;
  widget: DashboardWidgetType | 'none';
  targetId: string | 'none';
  anchorId: string | 'none';
  placement: Placement;
  size: WidgetSize;
  accountId: string | 'none';
  categoryId: string | 'none';
  dateRange: 'last_month' | 'this_month' | 'unchanged';
  sort: 'date_desc' | 'amount_desc' | 'amount_asc' | 'unchanged';
  transactionType: 'all' | 'expense' | 'income' | 'unchanged';
}
const sizeSpans = {small: 4, medium: 6, large: 8, full: 12} as const;
const ordered = (dashboard: DashboardDefinition) => [...dashboard.widgets].sort((a, b) => a.layout.order - b.layout.order);
function withOrder(dashboard: DashboardDefinition, widgets: DashboardWidgetInstance[]): DashboardDefinition {
  return {...dashboard, widgets: widgets.map((widget, order) => ({...widget, layout: {...widget.layout, order}}))};
}
function insert(widgets: DashboardWidgetInstance[], item: DashboardWidgetInstance, placement: Placement, anchorId: string | 'none') {
  if (placement === 'top') return [item, ...widgets];
  const index = widgets.findIndex(({id}) => id === anchorId);
  if (index < 0) return [...widgets, item];
  const before = placement === 'before' || placement === 'above';
  return [...widgets.slice(0, index + (before ? 0 : 1)), item, ...widgets.slice(index + (before ? 0 : 1))];
}
export function addDashboardWidget(dashboard: DashboardDefinition, type: DashboardWidgetType, placement: Placement = 'none', anchorId: string | 'none' = 'none', id = crypto.randomUUID()): DashboardDefinition {
  const entry = dashboardWidgetCatalog[type];
  if (!entry) throw new Error('Unknown widget type.');
  const widgets = ordered(dashboard);
  const anchor = widgets.find((widget) => widget.id === anchorId);
  const span = placement === 'beside' && anchor ? Math.min(entry.defaultSpan, 12 - anchor.layout.colSpan) : entry.defaultSpan;
  const colSpan = [4, 6, 8, 12].includes(span) ? span : entry.defaultSpan;
  const item: DashboardWidgetInstance = {id, type, config: {}, layout: {colSpan, order: widgets.length, newRow: placement === 'below' || placement === 'above'}};
  const arranged = insert(widgets, item, placement, anchorId);
  return withOrder(dashboard, placement === 'above' ? arranged.map((widget) => widget.id === anchorId ? {...widget, layout: {...widget.layout, newRow: true}} : widget) : arranged);
}
export function removeDashboardWidget(dashboard: DashboardDefinition, widgetId: string): DashboardDefinition {
  return withOrder(dashboard, ordered(dashboard).filter(({id}) => id !== widgetId));
}
export function moveDashboardWidget(dashboard: DashboardDefinition, widgetId: string, placement: Placement, anchorId: string | 'none'): DashboardDefinition {
  const widgets = ordered(dashboard);
  const item = widgets.find(({id}) => id === widgetId);
  if (!item || widgetId === anchorId || (placement !== 'top' && !widgets.some(({id}) => id === anchorId))) throw new Error('Choose a widget to move and a different destination.');
  const moved = {...item, layout: {...item.layout, newRow: placement === 'below' || placement === 'above'}};
  const arranged = insert(widgets.filter(({id}) => id !== widgetId), moved, placement, anchorId);
  return withOrder(dashboard, placement === 'above' ? arranged.map((widget) => widget.id === anchorId ? {...widget, layout: {...widget.layout, newRow: true}} : widget) : arranged);
}
export function resizeDashboardWidget(dashboard: DashboardDefinition, widgetId: string, size: WidgetSize): DashboardDefinition {
  if (size === 'unchanged') throw new Error('Choose a widget size.');
  return {...dashboard, widgets: dashboard.widgets.map((widget) => widget.id === widgetId ? {...widget, layout: {...widget.layout, colSpan: sizeSpans[size]}} : widget)};
}
export function configureDashboardWidget(dashboard: DashboardDefinition, widgetId: string, config: DashboardWidgetConfig): DashboardDefinition {
  return {...dashboard, widgets: dashboard.widgets.map((widget) => widget.id === widgetId ? {...widget, config: {...widget.config, ...config}} : widget)};
}
export function renameDashboard(dashboard: DashboardDefinition, name: string): DashboardDefinition {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new Error('Enter a dashboard name.');
  return {...dashboard, name: trimmed};
}
