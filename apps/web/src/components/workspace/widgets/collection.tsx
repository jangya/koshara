'use client';

import {Grid} from '@astryxdesign/core/Grid';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {useMemo} from 'react';

import {formatDateRange} from '@/lib/date-range';
import {buildDashboardViewModel} from '@/lib/dashboard-insights';
import {useKosharaState} from '@/lib/koshara-store';
import type {WorkspaceWidgetRequest} from './parse-widget-request';
import {workspaceWidgetRegistry, type WorkspaceWidgetType} from '@/components/finance-widgets/registry';

export function WorkspaceWidgetCollection({request}: {request: WorkspaceWidgetRequest}) {
  const fullState = useKosharaState();
  const state = useMemo(() => request.categoryIds === undefined ? fullState : {
    ...fullState,
    transactions: fullState.transactions.filter(({categoryId}) => request.categoryIds?.includes(categoryId)),
  }, [fullState, request.categoryIds]);
  const view = useMemo(() => buildDashboardViewModel(state, request.range), [state, request.range]);
  const period = formatDateRange(request.range);
  const previousPeriod = formatDateRange(view.previousRange);
  const props = {state, range: request.range, view, period, previousPeriod};
  const metricIds = request.widgets.filter((id) => workspaceWidgetRegistry[id].kind === 'metric');
  const visualIds = request.widgets.filter((id) => workspaceWidgetRegistry[id].kind === 'visual');

  function renderWidget(id: WorkspaceWidgetType) {
    const Widget = workspaceWidgetRegistry[id].component;
    return <Widget key={id} {...props} />;
  }

  return <VStack gap={4} aria-label="Workspace widgets">
    <Text type="supporting" color="secondary">{period}</Text>
    {request.categoryIds !== undefined ? <Text type="supporting" color="secondary">
      {request.categoryIds.length
        ? `Filtered categories: ${fullState.categories.filter(({id}) => request.categoryIds?.includes(id)).map(({name}) => name).join(', ')}`
        : 'No matching categories found. Showing no transactions.'}
    </Text> : null}
    {metricIds.length ? <Grid columns={{minWidth: 220, max: 2, repeat: 'fit'}} gap={4}>{metricIds.map(renderWidget)}</Grid> : null}
    {visualIds.map(renderWidget)}
  </VStack>;
}
