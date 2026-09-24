'use client';

import {Button} from '@astryxdesign/core/Button';
import {CodeBlock} from '@astryxdesign/core/CodeBlock';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {useEffect, useState, type FormEvent, type KeyboardEvent} from 'react';

import {getKosharaState} from '@/lib/koshara-store';
import {isValidIsoDate} from '@/lib/date-range';
import {workspaceCommands} from './commands';
import {classifyWorkspaceIntent} from './intents/classify-intent';
import {workspaceRegistry} from './intents/registry';
import type {WorkspaceDecision, WorkspaceIntent, WorkspaceResult} from './intents/types';
import type {WorkspaceIntentResponse} from '@/lib/decision/workspace-jev';
import {WorkspaceWidgetCollection} from './widgets/collection';
import {parseWidgetRequest, type WorkspaceWidgetRequest} from './widgets/parse-widget-request';
import {workspaceWidgetRegistry} from '@/components/finance-widgets/registry';

type RegisteredIntent = Exclude<WorkspaceIntent, 'unknown'>;
type ViewIntent = 'show_accounts' | 'show_expenses' | 'show_transactions';
type ActiveSurface = WorkspaceDecision & {id: string; intent: RegisteredIntent};
type DebugEntry = {id: string; phase: 'debounce' | 'api'; timestamp: string; request: unknown; response: unknown};
type WorkspaceRecord =
  | {id: string; kind: 'result'; title: string; detail?: string; createdAt: string}
  | {id: string; kind: 'view'; intent: ViewIntent; input: string; createdAt: string}
  | {id: string; kind: 'widgets'; request: WorkspaceWidgetRequest; input: string; createdAt: string};

const suggestions = [
  {label: 'Add expense', input: 'Add an expense'},
  {label: 'Import statement', input: 'Import a statement'},
  {label: 'Add account', input: 'Add an account'},
  {label: 'Check accounts', input: 'Show accounts'},
];

function isViewIntent(intent: WorkspaceIntent): intent is ViewIntent {
  return intent === 'show_accounts' || intent === 'show_expenses' || intent === 'show_transactions';
}

function readRecords(key: string): WorkspaceRecord[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(saved) ? saved.filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string'
      && (entry.kind === 'result' && typeof entry.title === 'string'
        || entry.kind === 'view' && isViewIntent(entry.intent) && typeof entry.input === 'string'
        || entry.kind === 'widgets' && Array.isArray(entry.request?.widgets)
          && entry.request.widgets.every((id: unknown) => typeof id === 'string' && Object.hasOwn(workspaceWidgetRegistry, id))
          && (entry.request.categoryIds === undefined || Array.isArray(entry.request.categoryIds)
            && entry.request.categoryIds.every((id: unknown) => typeof id === 'string'))
          && isValidIsoDate(entry.request?.range?.start) && isValidIsoDate(entry.request?.range?.end)
          && entry.request.range.start <= entry.request.range.end)) as WorkspaceRecord[] : [];
  } catch { return []; }
}

function parseDebugBody(body: string): unknown {
  try { return JSON.parse(body) as unknown; } catch { return body; }
}

export function WorkspacePage({debugEnabled = false}: {debugEnabled?: boolean}) {
  const [draft, setDraft] = useState('');
  const [prediction, setPrediction] = useState<WorkspaceDecision | null>(null);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [active, setActive] = useState<ActiveSurface | null>(null);
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const storageKey = 'koshara-workspace-log';

  useEffect(() => {
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      setRecords(readRecords(storageKey));
      setRecordsLoaded(true);
    });
    return () => { current = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!recordsLoaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify(records));
  }, [recordsLoaded, records, storageKey]);

  useEffect(() => {
    if (!debugEnabled) return;
    const originalFetch = window.fetch;
    let active = true;
    const observedFetch: typeof fetch = async (resource, init) => {
      const url = resource instanceof Request ? resource.url : String(resource);
      const target = new URL(url, window.location.href);
      if (target.origin !== window.location.origin || !target.pathname.startsWith('/api/')) return originalFetch(resource, init);
      const requestBody = typeof init?.body === 'string' ? parseDebugBody(init.body) : init?.body ? '[non-text request body]' : null;
      const request = {url: `${target.pathname}${target.search}`, method: init?.method ?? (resource instanceof Request ? resource.method : 'GET'), body: requestBody};
      const timestamp = new Date().toISOString();
      const headers = new Headers(resource instanceof Request ? resource.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
      headers.set('X-Koshara-Debug', 'true');
      try {
        const response = await originalFetch(resource, {...init, headers});
        let body: unknown;
        try { body = parseDebugBody(await response.clone().text()); }
        catch { body = '[response body unavailable]'; }
        if (active) setDebugEntries((entries) => [...entries, {
          id: crypto.randomUUID(), phase: 'api', timestamp, request, response: {status: response.status, body},
        }]);
        return response;
      } catch (error) {
        if (active) setDebugEntries((entries) => [...entries, {
          id: crypto.randomUUID(), phase: 'api', timestamp, request,
          response: {error: error instanceof Error ? error.message : String(error)},
        }]);
        throw error;
      }
    };
    window.fetch = observedFetch;
    return () => { active = false; if (window.fetch === observedFetch) window.fetch = originalFetch; };
  }, [debugEnabled]);

  useEffect(() => {
    const input = draft.trim();
    if (!input || input.startsWith('/')) return;
    let live = true;
    const timer = window.setTimeout(() => {
      void classifyWorkspaceIntent(input).then((decision) => {
        if (!live) return;
        setPrediction(decision);
        if (debugEnabled) setDebugEntries((entries) => [...entries, {
          id: crypto.randomUUID(), phase: 'debounce', timestamp: new Date().toISOString(),
          request: {classifier: 'local deterministic', input}, response: decision,
        }]);
      });
    }, 350);
    return () => { live = false; window.clearTimeout(timer); };
  }, [draft, debugEnabled]);

  const current = active;
  const slashQuery = draft.trim().startsWith('/') ? draft.trim().slice(1).toLowerCase() : null;
  const matchingCommands = slashQuery === null ? [] : workspaceCommands.filter((command) =>
    `${command.label} ${command.slash} ${command.prompt}`.toLowerCase().includes(slashQuery));
  const visiblePrediction = prediction?.input === draft.trim() && prediction.intent !== 'unknown' && slashQuery === null
    ? prediction : null;

  function addRecord(record: WorkspaceRecord) {
    setRecords((existing) => [...existing, record]);
  }

  function finish(result?: WorkspaceResult) {
    if (result) addRecord({id: crypto.randomUUID(), kind: 'result', title: result.title, detail: result.detail, createdAt: new Date().toISOString()});
    setActive(null);
    setDraft('');
  }

  async function submit(input: string) {
    if (!input.trim() || busy) return;
    const trimmedInput = input.trim();
    const command = trimmedInput.startsWith('/')
      ? workspaceCommands.find((entry) => entry.slash === trimmedInput.toLowerCase())
      : null;
    if (trimmedInput.startsWith('/') && !command) {
      setMessage('Choose a component from the list, then press Enter or Go.');
      return;
    }
    setBusy(true);
    try {
      const requestInput = command?.prompt ?? trimmedInput;
      const requestBody = {input: requestInput, debug: debugEnabled};
      let decision: WorkspaceDecision;
      try {
        const response = await fetch('/api/workspace-intent', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(requestBody),
        });
        const responseBody: unknown = await response.json();
        if (!response.ok) throw new Error(`Workspace intent request failed (${response.status}).`);
        decision = (responseBody as WorkspaceIntentResponse).decision;
      } catch (error) {
        decision = await classifyWorkspaceIntent(requestInput);
        if (debugEnabled) setDebugEntries((entries) => [...entries, {
          id: crypto.randomUUID(), phase: 'debounce', timestamp: new Date().toISOString(),
          request: {classifier: 'local deterministic fallback', input: requestInput},
          response: {error: error instanceof Error ? error.message : String(error), decision},
        }]);
      }
      if (decision.intent === 'unknown') {
        setMessage('Try a suggested prompt or type / to see available components.');
        return;
      }
      setMessage('');
      setPrediction(null);
      setDraft('');
      if (decision.intent === 'show_widget') {
        addRecord({id: crypto.randomUUID(), kind: 'widgets', request: parseWidgetRequest(decision.input, new Date(), getKosharaState().categories), input: decision.input, createdAt: new Date().toISOString()});
        setActive(null);
      } else if (isViewIntent(decision.intent)) {
        addRecord({id: crypto.randomUUID(), kind: 'view', intent: decision.intent, input: decision.input, createdAt: new Date().toISOString()});
        setActive(null);
      } else {
        setActive({...decision, intent: decision.intent, id: crypto.randomUUID()});
      }
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(draft);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit(draft);
    }
  }

  return <VStack className="workspace-page" gap={5} padding={5} maxWidth="calc(var(--spacing-12) * 16)" width="100%">
    <VStack gap={1} hAlign="center">
      <Heading level={1}>Koshara Workspace</Heading>
      <Text color="secondary">What would you like to do?</Text>
    </VStack>

    <Section className="workspace-composer" padding={4}>
      <VStack gap={3}>
        <form onSubmit={handleSubmit}>
          <HStack gap={2} vAlign="end">
            <TextArea label="Ask Kosara" value={draft} onChange={setDraft} onKeyDown={handleInputKeyDown}
              placeholder="Ask Kosara..." rows={2} size="lg" width="100%" hasAutoFocus />
            <Button label="Go" variant="primary" type="submit" isDisabled={!draft.trim() || busy} isLoading={busy} />
          </HStack>
        </form>
        <Text type="supporting" color="secondary">Type / to see available components. Press Enter or Go to open one.</Text>
        {visiblePrediction ? <Text type="supporting" color="secondary" role="status">
          Ready to open: {workspaceRegistry[visiblePrediction.intent as RegisteredIntent].title}. Press Enter or Go.
        </Text> : null}
        {slashQuery !== null ? <Section aria-label="Available components" padding={3}>
          <VStack gap={3}>
            <Heading level={2}>Available components</Heading>
            {matchingCommands.length ? (['Actions', 'Views', 'Widgets'] as const).map((group) => {
              const commands = matchingCommands.filter((command) => command.group === group);
              return commands.length ? <VStack key={group} gap={1}>
                <Heading level={3}>{group}</Heading>
                <VStack as="ul" gap={0}>
                  {commands.map((command) => <Item as="li" key={command.slash}
                    label={`${command.slash} · ${command.label}`} description={command.prompt}
                    onClick={() => { setDraft(command.prompt); setMessage(''); }} />)}
                </VStack>
              </VStack> : null;
            }) : <Text color="secondary">No matching components.</Text>}
          </VStack>
        </Section> : null}
        {message ? <Text role="status" color="secondary">{message}</Text> : null}
        {!current && records.length === 0 && slashQuery === null ? <HStack gap={2} wrap="wrap" hAlign="center" aria-label="Suggested actions">
          {suggestions.map(({label, input}) => <Button key={label} label={label} variant="ghost" size="sm" onClick={() => setDraft(input)} />)}
        </HStack> : null}
      </VStack>
    </Section>

    {current ? <VStack aria-label="Workspace surface">
      {(() => {
        const Surface = workspaceRegistry[current.intent].component;
        return <Surface key={current.id} input={current.input} onComplete={finish} />;
      })()}
    </VStack> : null}

    {records.length ? <VStack gap={3} aria-label="Workspace activity">
      <HStack gap={3} vAlign="center">
        <StackItem size="fill"><Heading level={2}>Activity</Heading></StackItem>
        <Button label="Clear activity" size="sm" variant="ghost" onClick={() => setRecords([])} />
      </HStack>
      <VStack as="ul" gap={2}>
        {[...records].reverse().map((record) => record.kind === 'result'
          ? <Item as="li" key={record.id} label={record.title} description={record.detail} />
          : <VStack as="li" key={record.id}>{record.kind === 'widgets'
            ? <WorkspaceWidgetCollection request={record.request} />
            : <RecordView record={record} />}</VStack>)}
      </VStack>
    </VStack> : null}

    {debugEnabled ? <Section aria-label="Workspace debug" padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center">
          <StackItem size="fill"><Heading level={2}>Debug: requests and responses</Heading></StackItem>
          <Button label="Clear debug log" size="sm" variant="ghost" onClick={() => setDebugEntries([])} />
        </HStack>
        <Text type="supporting" color="secondary">Local intent previews and Workspace API traffic appear here, including JEV details returned by the server. Authorization headers are excluded.</Text>
        {debugEntries.length ? debugEntries.map((entry) => <VStack key={entry.id} gap={2}>
          <Heading level={3}>{entry.phase === 'debounce' ? 'Debounced preview' : 'API request'} · {entry.timestamp}</Heading>
          <CodeBlock title="Request" language="json" code={JSON.stringify(entry.request, null, 2)} width="100%" isWrapped maxHeight="calc(var(--spacing-12) * 6)" />
          <CodeBlock title="Response" language="json" code={JSON.stringify(entry.response, null, 2)} width="100%" isWrapped maxHeight="calc(var(--spacing-12) * 6)" />
        </VStack>) : <Text color="secondary">No requests yet.</Text>}
      </VStack>
    </Section> : null}
  </VStack>;
}

function RecordView({record}: {record: Extract<WorkspaceRecord, {kind: 'view'}>}) {
  const Surface = workspaceRegistry[record.intent].component;
  return <Surface input={record.input} onComplete={() => {}} />;
}
