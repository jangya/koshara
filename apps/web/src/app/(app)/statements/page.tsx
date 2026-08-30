'use client';

import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {Selector} from '@astryxdesign/core/Selector';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useMemo, useState} from 'react';

import {Page} from '@/components/page';
import {copyPrompt, STATEMENT_IMPORT_PROMPT} from '@/lib/agent-prompts';
import {formatMinorCurrencySummary, formatTransactionDate} from '@/lib/format';
import {
  approveStatementImport,
  resolveStatementImportGroup,
  updateStatementImportItem,
  useKosharaState,
} from '@/lib/koshara-store';
import type {ImportItem, ImportItemStatus} from '@/lib/koshara-types';

type ReviewFilter = ImportItemStatus | 'all';

const statusLabels: Record<ImportItemStatus, string> = {
  ready: 'Ready',
  needs_attention: 'Needs attention',
  possible_duplicate: 'Possible duplicate',
  skipped: 'Skipped',
};

function ImportItemRow({item, accounts, categories, isReadOnly, onEditDescription, onError}: {
  item: ImportItem;
  accounts: Array<{id: string; name: string}>;
  categories: Array<{id: string; name: string}>;
  isReadOnly: boolean;
  onEditDescription: (item: ImportItem) => void;
  onError: (message: string) => void;
}) {
  async function update(updates: Parameters<typeof updateStatementImportItem>[2]) {
    try {
      await updateStatementImportItem(item.importSessionId, item.id, updates);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The staged transaction could not be updated.');
    }
  }

  const primaryAction = item.status === 'possible_duplicate'
    ? <Button label="Include anyway" size="sm" variant="secondary" isDisabled={isReadOnly} onClick={() => void update({includeDuplicate: true})} />
    : item.status === 'skipped'
      ? <Button label="Restore" size="sm" variant="secondary" isDisabled={isReadOnly} onClick={() => void update({status: 'ready'})} />
      : <Button label="Skip" size="sm" variant="ghost" isDisabled={isReadOnly} onClick={() => void update({status: 'skipped'})} />;

  return (
    <Item
      as="li"
      label={
        <VStack gap={1}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="supporting" color="secondary">{formatTransactionDate(item.date)}</Text>
            <Text>{item.description}</Text>
            <Badge label={statusLabels[item.status]} variant="neutral" />
          </HStack>
          {item.note ? <Text type="supporting" color="secondary">{item.note}</Text> : null}
          {item.duplicateTransactionIds.length > 0 ? (
            <Text type="supporting" color="secondary">
              Matches {item.duplicateTransactionIds.length} existing {item.duplicateTransactionIds.length === 1 ? 'transaction' : 'transactions'}.
            </Text>
          ) : null}
        </VStack>
      }
      description={
        <HStack gap={2} wrap="wrap" vAlign="end">
          <Selector
            label="Proposed category"
            value={item.proposedCategoryId}
            onChange={(value) => void update({proposedCategoryId: value})}
            options={categories.map(({id, name}) => ({value: id, label: name}))}
            size="sm"
            isDisabled={isReadOnly}
          />
          <Selector
            label="Account"
            value={item.proposedAccountId}
            onChange={(value) => void update({proposedAccountId: value})}
            options={accounts.map(({id, name}) => ({value: id, label: name}))}
            size="sm"
            isDisabled={isReadOnly}
          />
          <Button label="Edit description" variant="ghost" size="sm" isDisabled={isReadOnly} onClick={() => onEditDescription(item)} />
        </HStack>
      }
      endContent={
        <VStack gap={2} hAlign="end">
          <Text hasTabularNumbers>{item.kind === 'expense' ? '−' : '+'}{formatMinorCurrencySummary(item.amountMinor, 'INR')}</Text>
          {primaryAction}
        </VStack>
      }
      align="start"
      density="spacious"
    />
  );
}

export default function StatementsPage() {
  const state = useKosharaState();
  const session = state.importSessions.find(({status}) => status === 'draft' || status === 'ready_for_review')
    ?? state.importSessions[0]
    ?? null;
  const [filter, setFilter] = useState<ReviewFilter>('needs_attention');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [error, setError] = useState('');
  const [editingItem, setEditingItem] = useState<ImportItem | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const counts = useMemo(() => {
    const items = session?.items ?? [];
    return {
      ready: items.filter(({status}) => status === 'ready').length,
      needs_attention: items.filter(({status}) => status === 'needs_attention').length,
      possible_duplicate: items.filter(({status}) => status === 'possible_duplicate').length,
      skipped: items.filter(({status}) => status === 'skipped').length,
      all: items.length,
    };
  }, [session]);
  const visibleItems = (session?.items ?? []).filter((item) => filter === 'all' || item.status === filter);
  const unresolvedGroups = session?.groups.filter(({resolution}) => resolution === 'proposed') ?? [];
  const groupedItemIds = new Set(session?.groups.filter(({resolution}) => resolution !== 'separate').flatMap(({itemIds}) => itemIds) ?? []);
  const importableCount = (session?.items.filter((item) => item.status === 'ready' && item.included && !groupedItemIds.has(item.id)).length ?? 0)
    + (session?.groups.filter(({resolution}) => resolution === 'merged').length ?? 0);

  function openDescriptionEditor(item: ImportItem) {
    setEditingItem(item);
    setDescriptionDraft(item.description);
  }

  async function saveDescription() {
    if (!editingItem) return;
    try {
      await updateStatementImportItem(editingItem.importSessionId, editingItem.id, {description: descriptionDraft});
      setEditingItem(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'The description could not be updated.');
    }
  }

  async function copyImportPrompt() {
    try {
      await copyPrompt(STATEMENT_IMPORT_PROMPT);
      setCopyFeedback('Import prompt copied.');
    } catch {
      setCopyFeedback('Could not copy the prompt. Select it from the agent tools panel instead.');
    }
  }

  return (
    <>
      <Page
        title="Statements"
        description="Import bank and credit-card statements and review them before adding them to Koshara."
      >
        <VStack gap={5}>
          {!session ? (
            <Section>
              <VStack gap={4}>
                <VStack gap={1}>
                  <Heading level={2}>Import a statement with your AI</Heading>
                  <Text color="secondary">
                    Let your preferred AI analyze your bank or credit-card statement, match it against your Koshara data, detect possible duplicates, and prepare transactions for your review.
                  </Text>
                </VStack>
                <VStack gap={2} hAlign="start">
                  <Button label={copyFeedback === 'Import prompt copied.' ? 'Prompt copied' : 'Copy import prompt'} variant="primary" onClick={() => void copyImportPrompt()} />
                  {copyFeedback ? <Text type="supporting" color="secondary">{copyFeedback}</Text> : null}
                  <Text type="supporting" color="secondary">
                    Your AI proposes changes. You review and approve them before anything is imported.
                  </Text>
                </VStack>
                <Collapsible trigger="Privacy and data handling" defaultIsOpen={false}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">
                      Financial statements may contain sensitive information. Review and redact personal identifiers before sharing your statement with an external AI service.
                    </Text>
                    <Text type="supporting" color="secondary">Koshara demo data is stored locally in this browser.</Text>
                  </VStack>
                </Collapsible>
              </VStack>
            </Section>
          ) : null}

          {error ? <Banner status="error" title="Statement review update failed" description={error} isDismissable onDismiss={() => setError('')} /> : null}

          {session ? (
            <Section padding={0}>
              <VStack gap={0}>
                <VStack gap={4} padding={4}>
                  <HStack gap={3} vAlign="center" wrap="wrap">
                    <StackItem size="fill">
                      <VStack gap={1}>
                        <Heading level={2}>Import review</Heading>
                        <Text color="secondary">{session.sourceName} · {counts.all} proposed {counts.all === 1 ? 'transaction' : 'transactions'}</Text>
                      </VStack>
                    </StackItem>
                    <Badge label={session.status === 'imported' ? 'Imported' : 'Ready for review'} variant="neutral" />
                  </HStack>

                  <Grid columns={{minWidth: 120, max: 5, repeat: 'fit'}} gap={3}>
                    {[
                      ['Ready', counts.ready],
                      ['Need attention', counts.needs_attention],
                      ['Duplicates', counts.possible_duplicate],
                      ['Suggested merges', unresolvedGroups.length],
                      ['Skipped', counts.skipped],
                    ].map(([label, value]) => (
                      <Card key={String(label)} padding={3} variant="muted">
                        <VStack gap={1}>
                          <Text type="supporting" color="secondary">{label}</Text>
                          <Text type="display-3" hasTabularNumbers>{value}</Text>
                        </VStack>
                      </Card>
                    ))}
                  </Grid>
                </VStack>

                {session.approvedTransactionIds.length > 0 ? (
                  <VStack padding={4}>
                    <Banner
                      status="success"
                      title={`${session.approvedTransactionIds.length} ${session.approvedTransactionIds.length === 1 ? 'transaction was' : 'transactions were'} added to Koshara`}
                      description={session.status === 'imported'
                        ? 'The completed import remains available here as a local review record.'
                        : 'Ready rows were added. Review the remaining rows, then approve the next batch.'}
                      endContent={<Link href="/transactions" isStandalone>View imported transactions</Link>}
                    />
                  </VStack>
                ) : null}

                {unresolvedGroups.length > 0 ? (
                  <VStack gap={0} padding={4}>
                    <Heading level={3}>Suggested groups</Heading>
                    <VStack as="ul" gap={0}>
                      {unresolvedGroups.map((group) => (
                        <Item
                          as="li"
                          key={group.id}
                          label={group.label}
                          description={
                            <VStack gap={1}>
                              {session.items.filter((item) => group.itemIds.includes(item.id)).map((item) => (
                                <Text key={item.id} type="supporting" color="secondary">
                                  {item.description}: {formatMinorCurrencySummary(item.amountMinor, 'INR')}
                                </Text>
                              ))}
                              <Text>Proposed: {group.proposedDescription} · {formatMinorCurrencySummary(group.proposedAmountMinor, 'INR')}</Text>
                            </VStack>
                          }
                          endContent={
                            <VStack gap={1} hAlign="end">
                              <Button label="Merge" size="sm" variant="primary" isDisabled={session.status !== 'ready_for_review'} onClick={() => void resolveStatementImportGroup(session.id, group.id, 'merged')} />
                              <Button label="Keep separate" size="sm" variant="secondary" isDisabled={session.status !== 'ready_for_review'} onClick={() => void resolveStatementImportGroup(session.id, group.id, 'separate')} />
                            </VStack>
                          }
                          align="start"
                          density="spacious"
                        />
                      ))}
                    </VStack>
                  </VStack>
                ) : null}

                <HStack style={{overflowX: 'auto'}}>
                  <TabList value={filter} onChange={(value) => setFilter(value as ReviewFilter)} hasDivider>
                    <Tab value="needs_attention" label={`Needs attention (${counts.needs_attention})`} />
                    <Tab value="ready" label={`Ready (${counts.ready})`} />
                    <Tab value="possible_duplicate" label={`Duplicates (${counts.possible_duplicate})`} />
                    <Tab value="skipped" label={`Skipped (${counts.skipped})`} />
                    <Tab value="all" label={`All (${counts.all})`} />
                  </TabList>
                </HStack>

                {visibleItems.length > 0 ? (
                  <VStack as="ul" gap={0}>
                    {visibleItems.map((item) => (
                      <ImportItemRow
                        key={item.id}
                        item={item}
                        accounts={state.accounts}
                        categories={state.categories}
                        isReadOnly={session.status !== 'ready_for_review'}
                        onEditDescription={openDescriptionEditor}
                        onError={setError}
                      />
                    ))}
                  </VStack>
                ) : (
                  <EmptyState
                    title={`No ${filter === 'all' ? 'staged transactions' : statusLabels[filter].toLocaleLowerCase()}`}
                    description={filter === 'needs_attention' ? 'You are caught up. Check Ready or All to inspect more rows.' : 'Choose another review filter.'}
                    headingLevel={3}
                  />
                )}

                <HStack
                  gap={3}
                  padding={4}
                  vAlign="center"
                  wrap="wrap"
                  style={{paddingBlockEnd: 'calc(var(--spacing-12) + var(--spacing-4))'}}
                >
                  <StackItem size="fill">
                    <Text type="supporting" color="secondary">
                      Only ready rows and confirmed merges are imported. Skipped, duplicate, and unresolved rows stay out of Transactions.
                    </Text>
                  </StackItem>
                  <Button
                    label={session.status === 'imported' ? 'Import approved' : `Approve import${importableCount > 0 ? ` (${importableCount})` : ''}`}
                    variant="primary"
                    isDisabled={session.status !== 'ready_for_review' || importableCount === 0}
                    onClick={() => setApproveOpen(true)}
                  />
                </HStack>
              </VStack>
            </Section>
          ) : (
            <Section variant="muted">
              <VStack gap={1}>
                <Heading level={2}>No statement prepared yet</Heading>
                <Text color="secondary">
                  Open Koshara with a WebMCP-capable AI, share your statement, and use the import prompt. Proposed transactions will appear here for review.
                </Text>
              </VStack>
            </Section>
          )}
        </VStack>
      </Page>

      <Dialog isOpen={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)} purpose="form">
        <Layout
          header={<DialogHeader title="Edit proposed description" onOpenChange={(open) => !open && setEditingItem(null)} />}
          content={
            <LayoutContent>
              <TextInput label="Description" value={descriptionDraft} onChange={setDescriptionDraft} isRequired />
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button label="Cancel" variant="secondary" onClick={() => setEditingItem(null)} />
                <Button label="Save description" variant="primary" onClick={() => void saveDescription()} isDisabled={!descriptionDraft.trim()} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <AlertDialog
        isOpen={approveOpen}
        onOpenChange={(open) => !open && !isApproving && setApproveOpen(false)}
        title="Approve this statement import?"
        description={`${importableCount} reviewed ${importableCount === 1 ? 'transaction' : 'transactions'} will be added to Koshara. Skipped and unresolved items will remain excluded.`}
        actionLabel="Approve import"
        actionVariant="primary"
        isActionLoading={isApproving}
        onAction={async () => {
          if (!session) return;
          setIsApproving(true);
          try {
            await approveStatementImport(session.id);
            setApproveOpen(false);
          } catch (approvalError) {
            setError(approvalError instanceof Error ? approvalError.message : 'The import could not be approved.');
          } finally {
            setIsApproving(false);
          }
        }}
      />
    </>
  );
}
