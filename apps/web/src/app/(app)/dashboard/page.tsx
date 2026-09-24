'use client';

import {Button} from '@astryxdesign/core/Button';
import {ChatComposer, ChatComposerInput, ChatDictationButton, useChatDictation, type ChatComposerInputHandle} from '@astryxdesign/core/Chat';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid, GridSpan} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {SelectableCard} from '@astryxdesign/core/SelectableCard';
import {Selector} from '@astryxdesign/core/Selector';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import {Pencil} from 'lucide-react';
import {useSearchParams} from 'next/navigation';

import {DateRangeControl, useDateRangeSearchParams} from '@/components/date-range-control';
import {dashboardWidgetRegistry, type WorkspaceWidgetProps} from '@/components/finance-widgets/registry';
import {formatDateRange, getDateRangePreset} from '@/lib/date-range';
import {buildDashboardViewModel} from '@/lib/dashboard-insights';
import {loadDashboards, saveDashboards, type DashboardDefinition, type DashboardWidgetConfig, type DashboardWidgetInstance} from '@/lib/dashboard-definition';
import {addDashboardWidget, configureDashboardWidget, moveDashboardWidget, removeDashboardWidget, renameDashboard, resizeDashboardWidget, type DashboardDecision} from '@/lib/dashboard-tools';
import {useKosharaState} from '@/lib/koshara-store';

const suggestions = [
  {label: 'Monthly spending', type: 'spending'}, {label: 'Monthly income', type: 'income'},
  {label: 'Recent transactions', type: 'recent_transactions'}, {label: 'Cash flow', type: 'cashflow'},
  {label: 'Accounts', type: 'accounts'}, {label: 'Budget', type: 'budget'},
] as const;
function emptyDashboard(): DashboardDefinition { return {id: crypto.randomUUID(), name: '', widgets: []}; }
function sortedWidgets(dashboard: DashboardDefinition) { return [...dashboard.widgets].sort((a, b) => a.layout.order - b.layout.order); }

function DashboardContent() {
  const searchParams = useSearchParams();
  const newRequested = searchParams.get('new') === '1';
  const [startFresh] = useState(newRequested);
  const state = useKosharaState();
  const isMobile = useMediaQuery('(max-width: 48rem)');
  const isTablet = useMediaQuery('(max-width: 64rem)');
  const {range, preset, setRange} = useDateRangeSearchParams();
  const view = useMemo(() => buildDashboardViewModel(state, range), [state, range]);
  const widgetProps: WorkspaceWidgetProps = {state, range, view, period: formatDateRange(range), previousPeriod: formatDateRange(view.previousRange)};
  const [saved, setSaved] = useState<DashboardDefinition[]>([]);
  const [draft, setDraft] = useState<DashboardDefinition | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastActiveWidgetId, setLastActiveWidgetId] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const commandInputRef = useRef<ChatComposerInputHandle>(null);
  const dictation = useChatDictation({lang: 'en-IN', inputRef: commandInputRef, onError: () => setNotice('Voice input could not start. Type your request instead.')});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      const dashboards = loadDashboards();
      setSaved(dashboards);
      setSelectedId(startFresh ? null : dashboards[0]?.id ?? null);
      setDraft(startFresh ? emptyDashboard() : dashboards[0] ?? emptyDashboard());
      setLoaded(true);
    });
  }, [startFresh]);
  const savedVersion = saved.find(({id}) => id === draft?.id);
  const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(savedVersion));

  function selectDashboard(id: string) {
    const next = saved.find((dashboard) => dashboard.id === id);
    if (!next) return;
    setDraft(next); setSelectedId(next.id); setLastActiveWidgetId(null); setEditingName(false); setShowSuggestions(false); setNotice('');
  }
  function createDashboard() {
    setDraft(emptyDashboard()); setSelectedId(null); setLastActiveWidgetId(null); setEditingName(false); setShowSuggestions(false); setNotice('');
  }
  function save() {
    if (!draft) return;
    const name = (editingName ? nameDraft : draft.name).trim();
    if (!name) { setNameDraft(draft.name); setEditingName(true); setNotice('Name this dashboard before saving.'); return; }
    const next = renameDashboard(draft, name);
    const dashboards = saved.some(({id}) => id === next.id) ? saved.map((item) => item.id === next.id ? next : item) : [...saved, next];
    saveDashboards(dashboards); setSaved(dashboards); setDraft(next); setSelectedId(next.id); setEditingName(false); setNotice('Dashboard saved.');
    if (newRequested) { const url = new URL(window.location.href); url.searchParams.delete('new'); window.history.replaceState(null, '', url); }
  }
  function reset() {
    if (savedVersion) { setDraft(savedVersion); setLastActiveWidgetId(null); setEditingName(false); setNotice('Unsaved changes discarded.'); }
    else if (saved[0]) selectDashboard(saved[0].id);
    else createDashboard();
  }
  function add(type: (typeof suggestions)[number]['type']) {
    if (!draft) return;
    const next = addDashboardWidget(draft, type, 'none', 'none');
    setDraft(next); setLastActiveWidgetId(next.widgets.at(-1)?.id ?? null); setShowSuggestions(false); setNotice(`${dashboardWidgetRegistry[type].title} added. Save changes when ready.`);
  }
  function resolveTarget(decision: DashboardDecision): DashboardWidgetInstance | null {
    if (!draft) return null;
    if (decision.targetId !== 'none') return draft.widgets.find(({id}) => id === decision.targetId) ?? null;
    const matches = draft.widgets.filter(({type}) => type === decision.widget);
    if (matches.length === 1) return matches[0] ?? null;
    if (lastActiveWidgetId && decision.widget === 'none') return draft.widgets.find(({id}) => id === lastActiveWidgetId) ?? null;
    return null;
  }
  function apply(decision: DashboardDecision) {
    if (!draft || decision.action === 'none') throw new Error('Koshara could not identify a supported dashboard change.');
    const target = resolveTarget(decision);
    const anchorId = decision.anchorId !== 'none' ? decision.anchorId : lastActiveWidgetId ?? 'none';
    if (decision.action === 'add_widget') {
      if (decision.widget === 'none') throw new Error('Choose a widget to add.');
      if (decision.placement !== 'none' && decision.placement !== 'top' && !draft.widgets.some(({id}) => id === anchorId)) throw new Error('Select or name the widget to place this beside.');
      const next = addDashboardWidget(draft, decision.widget, decision.placement, anchorId);
      setDraft(next); setLastActiveWidgetId(next.widgets.find((widget) => !draft.widgets.some(({id}) => id === widget.id))?.id ?? null);
    } else {
      if (!target) throw new Error('Select or name the widget you want to change.');
      let next = draft;
      if (decision.action === 'remove_widget') next = removeDashboardWidget(draft, target.id);
      if (decision.action === 'move_widget') next = moveDashboardWidget(draft, target.id, decision.placement, anchorId);
      if (decision.action === 'resize_widget') next = resizeDashboardWidget(draft, target.id, decision.size);
      if (decision.action === 'configure_widget') {
        if (target.type !== 'recent_transactions') throw new Error('Filtering is currently available for recent transactions.');
        const config: DashboardWidgetConfig = {};
        if (decision.accountId !== 'none') config.accountId = decision.accountId;
        if (decision.categoryId === 'food') {
          const food = state.categories.find(({name}) => name.toLowerCase() === 'food');
          const ids = food ? [food.id] : state.categories.filter(({name}) => /^(groceries|dining)$/i.test(name)).map(({id}) => id);
          if (!ids.length) throw new Error('No food category is available.');
          config.categoryIds = ids;
          config.categoryId = 'all';
        } else if (decision.categoryId !== 'none') { config.categoryId = decision.categoryId; config.categoryIds = undefined; }
        if (decision.dateRange !== 'unchanged') config.dateRange = getDateRangePreset(decision.dateRange === 'last_month' ? 'last-month' : 'this-month');
        if (decision.sort !== 'unchanged') config.sort = decision.sort;
        if (decision.transactionType !== 'unchanged') config.transactionType = decision.transactionType;
        if (!Object.keys(config).length) throw new Error('Koshara could not identify a transaction filter or sort change.');
        next = configureDashboardWidget(draft, target.id, config);
      }
      setDraft(next); setLastActiveWidgetId(decision.action === 'remove_widget' ? null : target.id);
    }
    setNotice('Draft updated. Save changes when ready.');
  }
  async function submit(input: string) {
    if (!draft || busy || input.trim().length < 3) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/dashboard-command', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
        input: input.trim(), widgets: draft.widgets.map(({id, type}) => ({id, type, title: dashboardWidgetRegistry[type].title})),
        accounts: state.accounts.map(({id, name}) => ({id, name})), categories: state.categories.map(({id, name}) => ({id, name})), lastActiveWidgetId,
      })});
      if (!response.ok) throw new Error('Koshara could not process that request.');
      const body = await response.json() as {decision: DashboardDecision | null};
      if (!body.decision) throw new Error('Koshara is unavailable. Your draft is unchanged.');
      apply(body.decision); setCommand('');
    } catch (error) { setCommand(input); setNotice(error instanceof Error ? error.message : 'The dashboard is unchanged.'); }
    finally { setBusy(false); }
  }
  function startRename() {
    if (!draft) return;
    setNameDraft(draft.name);
    setEditingName(true);
  }
  function commitName() {
    if (!draft) return;
    const name = nameDraft.trim();
    if (!name) { setNotice('Enter a dashboard name.'); return; }
    setDraft({...draft, name});
    setEditingName(false);
    setNotice('');
  }
  if (!loaded || !draft) return <Layout><LayoutContent padding={4}><Text>Loading dashboards…</Text></LayoutContent></Layout>;
  const selectedWidget = draft.widgets.find(({id}) => id === lastActiveWidgetId);
  const composer = <ChatComposer
    value={command}
    onChange={setCommand}
    onSubmit={(value) => { if (value.length >= 3) void submit(value); }}
    isDisabled={busy}
    density="compact"
    elevation="none"
    placeholder={selectedWidget ? `Change ${dashboardWidgetRegistry[selectedWidget.type].title}…` : 'Ask Koshara to change this dashboard…'}
    input={<ChatComposerInput handleRef={commandInputRef} label="Dashboard request" maxRows={2} hasHistory={false} pasteAsToken={false}
      onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && command.trim().length < 3) event.preventDefault(); }} />}
    footerActions={draft.widgets.length ? <Button label={showSuggestions ? 'Hide widgets' : 'Add widget'} variant="ghost" size="sm" onClick={() => setShowSuggestions(!showSuggestions)} /> : undefined}
    sendActions={<ChatDictationButton dictation={dictation} size="sm" />}
    sendButton={<Button label="Apply" variant="primary" size="sm" onClick={() => void submit(command)} isDisabled={busy || command.trim().length < 3} isLoading={busy} />}
  />;
  const suggestedWidgets = <HStack gap={1} wrap="wrap" aria-label="Add suggested widgets">
    {suggestions.map(({label, type}) => <Button key={type} label={label} variant="ghost" size="sm" onClick={() => add(type)} />)}
  </HStack>;

  return <Layout><LayoutContent padding={4}>
    <VStack gap={4} width="100%" maxWidth="calc(var(--spacing-12) * 24)" className="dashboard-composer-page">
      <HStack gap={2} vAlign="center" wrap="wrap">
        <StackItem size="fill">{editingName ? <HStack gap={2} vAlign="end" wrap="wrap">
          <TextInput label="Dashboard name" value={nameDraft} onChange={setNameDraft} placeholder="Monthly Overview" hasAutoFocus
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') { event.preventDefault(); commitName(); }
              if (event.key === 'Escape') setEditingName(false);
            }} />
          <Button label="Done" size="sm" onClick={commitName} />
          <Button label="Cancel rename" variant="ghost" size="sm" onClick={() => setEditingName(false)} />
        </HStack> : <HStack gap={1} vAlign="center">
          <Heading level={1} maxLines={1}>{draft.name || 'Untitled dashboard'}</Heading>
          <Button label="Rename dashboard" icon={<Pencil />} isIconOnly tooltip="Rename dashboard" variant="ghost" size="sm" onClick={startRename} />
        </HStack>}</StackItem>
        {saved.length ? <Selector label="Saved dashboard" size="sm" isLabelHidden value={selectedId ?? '__draft__'} onChange={selectDashboard} options={[
          ...(selectedId === null ? [{value: '__draft__', label: 'New dashboard draft'}] : []),
          ...saved.map(({id, name}) => ({value: id, label: name})),
        ]} /> : null}
        <Button label="New dashboard" variant="ghost" size="sm" onClick={createDashboard} />
        {dirty ? <Button label="Discard changes" variant="ghost" size="sm" onClick={reset} /> : null}
        <Button label="Save changes" variant="primary" size="sm" onClick={save}
          isDisabled={!dirty && !(editingName && nameDraft.trim() !== draft.name.trim())} />
      </HStack>
      <DateRangeControl range={range} preset={preset} onChange={setRange} compact />
      {draft.widgets.length === 0 ? <VStack gap={4} padding={6} hAlign="center" minHeight="calc(var(--spacing-12) * 7)">
        <EmptyState title="Create your dashboard" description="Ask Koshara or choose a widget to begin." headingLevel={2} />
        <VStack gap={2} width="100%" maxWidth="calc(var(--spacing-12) * 14)">
          {composer}
          {notice ? <Text role="status" color="secondary">{notice}</Text> : null}
          {suggestedWidgets}
        </VStack>
      </VStack> : <VStack gap={4}>
        <VStack gap={2} width="100%">
          {composer}
          {notice ? <Text role="status" color="secondary">{notice}</Text> : null}
          {showSuggestions ? suggestedWidgets : null}
        </VStack>
        <Grid columns={12} gap={4} className="dashboard-widget-grid" aria-label="Dashboard widgets">
          {sortedWidgets(draft).map((widget) => {
            const Widget = dashboardWidgetRegistry[widget.type].component;
            const span = isMobile ? 12 : isTablet && widget.layout.colSpan < 12 ? 6 : widget.layout.colSpan;
            return <GridSpan key={widget.id} columns={widget.layout.newRow ? undefined : span}
              style={widget.layout.newRow ? {gridColumn: `1 / span ${span}`} : undefined}>
              <SelectableCard className="dashboard-widget" label={`${dashboardWidgetRegistry[widget.type].title} widget`}
                isSelected={lastActiveWidgetId === widget.id} onChange={(selected) => setLastActiveWidgetId(selected ? widget.id : null)} padding={0} variant="transparent" height="100%">
                <Widget {...widgetProps} config={widget.config} />
              </SelectableCard>
            </GridSpan>;
          })}
        </Grid>
      </VStack>}
    </VStack>
  </LayoutContent></Layout>;
}
export default function DashboardPage() { return <Suspense fallback={<Layout><LayoutContent padding={4}><Text>Loading dashboards…</Text></LayoutContent></Layout>}><DashboardContent /></Suspense>; }
