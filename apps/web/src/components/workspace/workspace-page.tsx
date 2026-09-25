"use client";

import { Button } from "@astryxdesign/core/Button";
import { ChatComposer, ChatComposerInput } from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import {
  CommandPalette,
  CommandPaletteInput,
} from "@astryxdesign/core/CommandPalette";
import { Heading } from "@astryxdesign/core/Heading";
import { Section } from "@astryxdesign/core/Section";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { createStaticSource } from "@astryxdesign/core/Typeahead";
import { useEffect, useState } from "react";

import { TransactionForm } from "@/components/transaction-dialog";
import {
  formatMinorCurrencySummary,
  formatTransactionDate,
} from "@/lib/format";
import { useKosharaState } from "@/lib/koshara-store";
import { workspaceWidgetRegistry } from "@/components/finance-widgets/registry";
import type { WorkspaceIntentResponse } from "@/lib/decision/workspace-jev";
import { workspaceCommands } from "./commands";
import { classifyWorkspaceIntent } from "./intents/classify-intent";
import { parseExpense } from "./intents/parse-expense";
import { workspaceRegistry } from "./intents/registry";
import type {
  WorkspaceDecision,
  WorkspaceIntent,
  WorkspaceResult,
} from "./intents/types";
import { WorkspaceWidgetCollection } from "./widgets/collection";
import { parseWidgetRequest } from "./widgets/parse-widget-request";

type RegisteredIntent = Exclude<WorkspaceIntent, "unknown">;
type DebugEntry = {
  id: string;
  timestamp: string;
  input: string;
  response: unknown;
};
type Activity = WorkspaceResult & { id: string };
const activityKey = "koshara-workspace-log";

const suggestions = [
  { label: "Add expense", input: "Add an expense" },
  { label: "Import statement", input: "Import a statement" },
  { label: "Add account", input: "Add an account" },
  { label: "Check accounts", input: "Show accounts" },
];

const commandPaletteSource = createStaticSource(
  workspaceCommands.map((command) => ({
    id: command.slash,
    label: `${command.slash} · ${command.label}`,
    auxiliaryData: { group: command.group, prompt: command.prompt },
  })),
  { keywords: (item) => [item.auxiliaryData.prompt] },
);

export function WorkspacePage({
  debugEnabled = false,
}: {
  debugEnabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [prediction, setPrediction] = useState<WorkspaceDecision | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { accounts, categories } = useKosharaState();

  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
        const saved: unknown = JSON.parse(
          window.localStorage.getItem(activityKey) ?? "[]",
        );
        if (Array.isArray(saved))
          setActivities(
            saved.filter(
              (entry) =>
                entry &&
                typeof entry.id === "string" &&
                typeof entry.title === "string" &&
                (entry.kind === undefined || entry.kind === "result") &&
                (entry.detail === undefined ||
                  typeof entry.detail === "string"),
            ),
          );
      } catch {
        /* Ignore an invalid previous activity log. */
      }
      setActivitiesLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (activitiesLoaded)
      window.localStorage.setItem(
        activityKey,
        JSON.stringify(
          activities.map((activity) => ({ ...activity, kind: "result" })),
        ),
      );
  }, [activities, activitiesLoaded]);

  useEffect(() => {
    const input = draft.trim();
    if (!input || input.startsWith("/")) return;
    let live = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void classifyWorkspaceIntent(input).then((decision) => {
        if (!live) return;
        setPrediction(decision);
        if (debugEnabled)
          setDebugEntries((entries) => [
            ...entries,
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              input,
              response: { source: "local preview", decision },
            },
          ]);
        void fetch("/api/workspace-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input, debug: debugEnabled }),
          signal: controller.signal,
        })
          .then(async (response) => {
            if (!response.ok) return;
            const classified =
              (await response.json()) as WorkspaceIntentResponse;
            if (!live) return;
            // Keep an already visible form stable while its fields are being edited.
            if (
              decision.intent === "unknown" &&
              classified.decision.intent !== "unknown"
            ) {
              setPrediction(classified.decision);
            }
            if (debugEnabled)
              setDebugEntries((entries) => [
                ...entries,
                {
                  id: crypto.randomUUID(),
                  timestamp: new Date().toISOString(),
                  input,
                  response: classified,
                },
              ]);
          })
          .catch(() => {
            // The local classifier remains usable when the intent service is unavailable.
          });
      });
    }, 350);
    return () => {
      live = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [draft, debugEnabled]);

  const visiblePrediction =
    prediction?.input === draft.trim() && prediction.intent !== "unknown"
      ? (prediction as WorkspaceDecision & { intent: RegisteredIntent })
      : null;

  function changeDraft(value: string) {
    if (value.trim() === "/") {
      setDraft("");
      setPrediction(null);
      setCommandPaletteOpen(true);
      return;
    }
    setDraft(value);
  }

  function finish(completed?: WorkspaceResult) {
    setDraft("");
    setPrediction(null);
    if (completed)
      setActivities((previous) => [
        { ...completed, id: crypto.randomUUID() },
        ...previous,
      ]);
  }

  function selectPaletteCommand(value: string) {
    const command = workspaceCommands.find((entry) => entry.slash === value);
    if (!command) return;
    setCommandPaletteOpen(false);
    changeDraft(command.prompt);
  }

  function renderSurface(
    decision: WorkspaceDecision & { intent: RegisteredIntent },
  ) {
    const input = decision.input;
    if (decision.intent === "add_expense")
      return (
        <VStack
          aria-label="Expense form in composer"
          onClick={(event) => event.stopPropagation()}
        >
          <TransactionForm
            key={input}
            transaction={null}
            accounts={accounts}
            categories={categories}
            inline
            embedded
            expenseOnly
            initialExpense={parseExpense(input, categories)}
            submitLabel="Save"
            onClose={() => finish()}
            onSaved={(transaction) =>
              finish({
                title: "Expense added",
                detail: `${formatMinorCurrencySummary(transaction.amountMinor, "INR")} · ${transaction.description} · ${formatTransactionDate(transaction.date)}`,
              })
            }
          />
        </VStack>
      );
    if (decision.intent === "show_widget")
      return (
        <WorkspaceWidgetCollection
          request={parseWidgetRequest(input, new Date(), categories)}
        />
      );
    const Surface = workspaceRegistry[decision.intent].component;
    return <Surface key={decision.intent} input={input} onComplete={finish} />;
  }

  return (
    <VStack
      className="workspace-page"
      gap={5}
      padding={5}
      maxWidth="calc(var(--spacing-12) * 22)"
      width="100%"
    >
      <VStack gap={1} hAlign="center">
        <Heading level={1}>Koshara Workspace</Heading>
        <Text color="secondary">What would you like to do?</Text>
      </VStack>

      <Section className="workspace-composer" padding={4}>
        <VStack gap={3}>
          <ChatComposer
            elevation="none"
            density="compact"
            value={draft}
            onChange={changeDraft}
            onSubmit={() => {}}
            placeholder="Ask Kosara..."
            sendButton={<></>}
            input={
              <VStack gap={3}>
                <ChatComposerInput
                  label="Ask Kosara"
                  maxRows={2}
                  pasteAsToken={false}
                  hasHistory={false}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                />
                {visiblePrediction ? (
                  <VStack
                    className="workspace-result-scroll"
                    aria-label="Workspace result in composer"
                    gap={3}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderSurface(visiblePrediction)}
                  </VStack>
                ) : null}
              </VStack>
            }
          />
          <HStack gap={2} vAlign="center">
            <Button
              label="Open command palette"
              variant="ghost"
              size="sm"
              onClick={() => setCommandPaletteOpen(true)}
            >
              /
            </Button>
            <Text type="supporting" color="secondary">
              Type / for components
            </Text>
          </HStack>
          {!visiblePrediction && !draft ? (
            <HStack
              gap={2}
              wrap="wrap"
              hAlign="center"
              aria-label="Suggested actions"
            >
              {suggestions.map(({ label, input }) => (
                <Button
                  key={label}
                  label={label}
                  variant="ghost"
                  size="sm"
                  onClick={() => changeDraft(input)}
                />
              ))}
            </HStack>
          ) : null}
        </VStack>
      </Section>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        searchSource={commandPaletteSource}
        onValueChange={selectPaletteCommand}
        label="Workspace commands"
        input={
          <CommandPaletteInput
            label="Search workspace commands"
            placeholder="Search commands..."
          />
        }
      />

      {activities.length ? (
        <VStack gap={2} aria-label="Workspace activity">
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Heading level={2}>Activity</Heading>
            </StackItem>
            <Button
              label="Clear activity"
              variant="ghost"
              size="sm"
              onClick={() => setActivities([])}
            />
          </HStack>
          <VStack as="ul" gap={0}>
            {activities.map((activity) => (
              <VStack as="li" key={activity.id} gap={0} padding={2}>
                <Text>{activity.title}</Text>
                {activity.detail ? (
                  <Text
                    className="workspace-activity-detail"
                    type="supporting"
                    color="secondary"
                  >
                    {activity.detail}
                  </Text>
                ) : null}
              </VStack>
            ))}
          </VStack>
        </VStack>
      ) : null}

      {debugEnabled ? (
        <Section aria-label="Workspace debug" padding={4}>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center">
              <StackItem size="fill">
                <Heading level={2}>Debug: intent previews</Heading>
              </StackItem>
              <Button
                label="Clear debug log"
                size="sm"
                variant="ghost"
                onClick={() => setDebugEntries([])}
              />
            </HStack>
            <Text type="supporting" color="secondary">
              Local intent classifications appear as you type.
            </Text>
            {debugEntries.length ? (
              debugEntries.map((entry) => (
                <CodeBlock
                  key={entry.id}
                  title={`Preview · ${entry.timestamp}`}
                  language="json"
                  width="100%"
                  isWrapped
                  code={JSON.stringify(
                    {
                      input: entry.input,
                      response: entry.response,
                      availableWidgets: Object.keys(workspaceWidgetRegistry),
                    },
                    null,
                    2,
                  )}
                />
              ))
            ) : (
              <Text color="secondary">No requests yet.</Text>
            )}
          </VStack>
        </Section>
      ) : null}
    </VStack>
  );
}
