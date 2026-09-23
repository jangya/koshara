'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {FileInput} from '@astryxdesign/core/FileInput';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Section} from '@astryxdesign/core/Section';
import {Selector} from '@astryxdesign/core/Selector';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {useState} from 'react';

import {formatMinorCurrencySummary} from '@/lib/format';
import {createStatementImportSession, getKosharaState, stageImportTransactions} from '@/lib/koshara-store';
import type {Account, Category, ImportSession, TransactionInput} from '@/lib/koshara-types';
import {parsePdfStatement} from '@/lib/statement-parser/run';
import type {JevDecision, JevRow} from '@/lib/statement-parser/jev';
import type {ParseResult, ParsedTransaction, ReconciliationResult} from '@/lib/statement-parser/types';

type CategoryName = NonNullable<ParsedTransaction['classification']>['category'];
const categoryNames: Record<CategoryName, string[]> = {
  FOOD: ['dining', 'food'], GROCERIES: ['groceries'], SHOPPING: ['shopping'], TRANSPORT: ['transport'],
  UTILITIES: ['utilities'], RENT: ['rent'], EMI: ['emi'], TRANSFER: ['transfer'], SALARY: ['salary', 'income'],
  INVESTMENT: ['investment'], HEALTHCARE: ['healthcare', 'medical'], ENTERTAINMENT: ['entertainment'],
  FEES: ['fees'], OTHER: ['miscellaneous'],
};

function localCategory(category: CategoryName, categories: Category[]) {
  return categories.find(({name}) => categoryNames[category].includes(name.toLocaleLowerCase()))?.id ?? 'uncategorized';
}

function existingCategory(description: string, categories: Category[]): CategoryName | undefined {
  const previous = getKosharaState().transactions.find((transaction) => transaction.reviewStatus === 'confirmed'
    && transaction.description.trim().toLocaleLowerCase() === description.trim().toLocaleLowerCase());
  if (!previous) return undefined;
  return (Object.keys(categoryNames) as CategoryName[]).find((name) => previous.categoryId !== 'uncategorized'
    && localCategory(name, categories) === previous.categoryId);
}

async function classifyRows(rows: ParsedTransaction[], categories: Category[]): Promise<ParsedTransaction[]> {
  const candidates: JevRow[] = rows.map((row) => ({
    date: row.date, description: row.description, amountMinor: row.amountMinor, kind: row.kind,
    balanceMinor: row.balanceMinor, sourcePage: row.sourcePage, confidence: row.confidence,
    directionAmbiguous: row.directionAmbiguous, knownCategory: existingCategory(row.description, categories),
  }));
  let decisions: JevDecision[] = [];
  try {
    const response = await fetch('/api/statement-classify', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({rows: candidates}),
    });
    if (response.ok) decisions = (await response.json() as {decisions: JevDecision[]}).decisions;
  } catch { /* Keep reconstructed rows for manual review. */ }
  return rows.map((row, index) => {
    const decision = decisions[index] ?? {isTransaction: true, category: candidates[index]?.knownCategory ?? 'OTHER', needsReview: true};
    return {
      ...row,
      kind: row.directionAmbiguous && decision.direction && decision.direction !== 'UNKNOWN'
        ? decision.direction === 'CREDIT' ? 'income' : 'expense' : row.kind,
      classification: {
        isTransaction: decision.isTransaction,
        category: decision.category,
        categoryConfidence: decision.categoryConfidence,
        needsReview: decision.needsReview || localCategory(decision.category, categories) === 'uncategorized'
          || Boolean(row.directionAmbiguous && (!decision.direction || decision.direction === 'UNKNOWN')),
      },
    };
  });
}

function currency(value: number | undefined) {
  return value === undefined ? 'Not found' : formatMinorCurrencySummary(value, 'INR');
}

export function ReconciliationSummary({result}: {result: ReconciliationResult}) {
  const isCreditCard = result.balanceConvention === 'credit-card';
  const calculated = result.openingBalanceMinor === undefined
    ? undefined
    : result.openingBalanceMinor + (isCreditCard
      ? result.extractedDebitsMinor - result.extractedCreditsMinor
      : result.extractedCreditsMinor - result.extractedDebitsMinor);
  const calculatedFromStatementTotals = result.openingBalanceMinor === undefined
    || result.statedDebitsMinor === undefined
    || result.statedCreditsMinor === undefined
    ? undefined
    : result.openingBalanceMinor + (isCreditCard
      ? result.statedDebitsMinor - result.statedCreditsMinor
      : result.statedCreditsMinor - result.statedDebitsMinor);
  const summaryBalances = calculatedFromStatementTotals !== undefined
    && result.closingBalanceMinor !== undefined
    && Math.abs(calculatedFromStatementTotals - result.closingBalanceMinor) <= 1;
  const missingCreditRows = result.statedCreditsMinor !== undefined
    && result.statedCreditsMinor > result.extractedCreditsMinor + 1;
  const debitsMatch = result.statedDebitsMinor !== undefined
    && Math.abs(result.statedDebitsMinor - result.extractedDebitsMinor) <= 1;
  const description = result.status === 'failed' && summaryBalances && missingCreditRows && debitsMatch
    ? `The statement summary balances, but its ${isCreditCard ? 'payments / credits' : 'credits'} total is ${currency(result.statedCreditsMinor)} and only ${currency(result.extractedCreditsMinor)} appears in the reconstructed transaction rows. Review the missing credit entries before approving this import.`
    : result.issues.length
      ? result.issues.join(' ')
      : result.status === 'unavailable'
        ? 'Statement totals were not found. Review the reconstructed rows before import.'
        : undefined;
  return (
    <VStack gap={3}>
      <Banner
        status={result.status === 'passed' ? 'success' : result.status === 'failed' ? 'error' : 'warning'}
        title={result.status === 'passed' ? 'Statement reconciled' : result.status === 'failed' ? 'Reconciliation failed — review required' : 'Reconciliation needs review'}
        description={description}
      />
      <MetadataList columns="multi">
        <MetadataListItem label={isCreditCard ? 'Previous statement dues' : 'Opening balance'}>{currency(result.openingBalanceMinor)}</MetadataListItem>
        <MetadataListItem label="Credits in transaction rows">{currency(result.extractedCreditsMinor)}</MetadataListItem>
        <MetadataListItem label={isCreditCard ? 'Payments / credits stated' : 'Credits stated'}>{currency(result.statedCreditsMinor)}</MetadataListItem>
        <MetadataListItem label="Debits in transaction rows">{currency(result.extractedDebitsMinor)}</MetadataListItem>
        <MetadataListItem label={isCreditCard ? 'Purchases / debits stated' : 'Debits stated'}>{currency(result.statedDebitsMinor)}</MetadataListItem>
        <MetadataListItem label="Closing calculated from rows">{currency(calculated)}</MetadataListItem>
        {calculatedFromStatementTotals !== undefined ? <MetadataListItem label="Closing from statement totals">{currency(calculatedFromStatementTotals)}</MetadataListItem> : null}
        <MetadataListItem label={isCreditCard ? 'Statement amount due' : 'Statement closing'}>{currency(result.closingBalanceMinor)}</MetadataListItem>
        <MetadataListItem label="Difference from rows">{currency(result.differenceMinor)}</MetadataListItem>
      </MetadataList>
    </VStack>
  );
}

export function PdfStatementImport({accounts, activeSession}: {accounts: Account[]; activeSession: ImportSession | null}) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');
  const [isStaging, setIsStaging] = useState(false);
  const busy = Boolean(progress) || isStaging;
  const hasActiveRows = Boolean(activeSession && activeSession.status === 'ready_for_review' && activeSession.items.length);

  async function readFile(selected: File | File[] | null) {
    const next = Array.isArray(selected) ? selected[0] : selected;
    setFile(next ?? null);
    setResult(null);
    setError('');
    if (!next) return;
    if (!accountId) { setError('Choose an account before selecting a PDF.'); setFile(null); return; }
    if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF statement.');
      setFile(null);
      return;
    }
    setSourceName(next.name);
    try {
      const parsed = await parsePdfStatement(next, accounts.find(({id}) => id === accountId)?.type === 'credit-card', setProgress);
      setProgress('Classifying reconstructed rows');
      const classified = {...parsed, transactions: await classifyRows(parsed.transactions, getKosharaState().categories)};
      const excluded = classified.transactions.filter((row) => row.classification?.isTransaction === false);
      const included = classified.transactions.filter((row) => row.classification?.isTransaction !== false);
      const extractedDebitsMinor = included.filter((row) => row.kind === 'expense').reduce((sum, row) => sum + row.amountMinor, 0);
      const extractedCreditsMinor = included.filter((row) => row.kind === 'income').reduce((sum, row) => sum + row.amountMinor, 0);
      if (excluded.length || extractedDebitsMinor !== parsed.reconciliation.extractedDebitsMinor || extractedCreditsMinor !== parsed.reconciliation.extractedCreditsMinor) {
        classified.reconciliation = {
          ...classified.reconciliation,
          status: classified.reconciliation.status === 'failed' ? 'failed' : 'warning',
          extractedDebitsMinor,
          extractedCreditsMinor,
          issues: [...classified.reconciliation.issues, 'Jev changed the staged row set or direction. Check the PDF and reconciliation before import.'],
        };
      }
      setResult(classified);
      if (parsed.transactions.length === 0) {
        setError(parsed.diagnostics.status === 'no_text_layer'
          ? 'No usable PDF text layer was found. Scanned statements need OCR and are not supported.'
          : parsed.diagnostics.status === 'no_transaction_table'
            ? 'No transaction table was found in the PDF text.'
            : `Transaction-like rows were found, but none could be validated. No rows were staged. Rejected: ${parsed.diagnostics.rejectionReasons.date} date, ${parsed.diagnostics.rejectionReasons.description} description, ${parsed.diagnostics.rejectionReasons.amount} amount, ${parsed.diagnostics.rejectionReasons.direction} direction.`);
      }
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'This PDF could not be read.');
    } finally {
      setProgress('');
      setFile(null);
    }
  }

  async function stage() {
    if (!result || !accountId || !sourceName || hasActiveRows) return;
    setIsStaging(true);
    setError('');
    try {
      const categories = getKosharaState().categories;
      const inputs: TransactionInput[] = result.transactions.filter((row) => row.classification?.isTransaction !== false).map((row) => ({
        date: row.date,
        description: row.description,
        amountMinor: row.amountMinor,
        kind: row.kind,
        accountId,
        categoryId: localCategory(row.classification?.category ?? 'OTHER', categories),
        reviewStatus: row.classification?.needsReview || localCategory(row.classification?.category ?? 'OTHER', categories) === 'uncategorized'
          ? 'needs_review' : 'confirmed',
        source: 'pdf',
        confidence: row.confidence,
        notes: `Parsed from PDF page ${row.sourcePage}${row.sourceItems?.length ? ` at y=${row.sourceItems[0]?.y.toFixed(2)}` : ''}.`,
      }));
      if (!inputs.length) { setError('No real transaction rows remain to stage.'); return; }
      const session = await createStatementImportSession({sourceName, accountId});
      await stageImportTransactions(session.id, inputs, {pdfParse: {
        reconciliation: result.reconciliation,
        unparsedRows: result.unparsedRows,
          reconstructedRows: inputs.length,
      }});
      setResult(null);
    } catch (stageError) {
      setError(stageError instanceof Error ? stageError.message : 'The parsed rows could not be staged.');
    } finally {
      setIsStaging(false);
    }
  }

  return (
    <Section>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>Import a PDF in this browser</Heading>
          <Text color="secondary">Select a digitally generated statement. PDF extraction stays in this tab. Reconstructed transaction fields are sent to TypeSafe Jev for classification, then staged locally for review.</Text>
        </VStack>
        {hasActiveRows ? <Banner status="info" title="Finish the current statement review first" description="An import is already staged. Approve or review its rows before starting another PDF." /> : null}
        <Selector
          label="Import into account"
          value={accountId}
          onChange={(value) => {setAccountId(value); setResult(null);}}
          placeholder="Choose an existing account"
          options={accounts.map(({id, name}) => ({value: id, label: name}))}
          isRequired
          isDisabled={busy || hasActiveRows}
        />
        <FileInput
          label="PDF statement"
          value={file}
          onChange={(selected) => void readFile(selected)}
          accept="application/pdf,.pdf"
          maxSize={20 * 1024 * 1024}
          mode="dropzone"
          isDisabled={busy || hasActiveRows || !accountId}
          isLoading={busy}
          description="Digitally generated PDF, up to 20 MB. Scanned statements are not supported."
        />
        {progress ? <Text role="status">{progress}</Text> : null}
        {error ? <Banner status="error" title="PDF import could not continue" description={error} /> : null}
        {result ? (
          <VStack gap={4}>
            <Text>{result.transactions.length} transactions reconstructed{result.unparsedRows ? ` · ${result.unparsedRows} rows could not be parsed` : ''}.</Text>
            <VStack as="ul" gap={0}>
              {result.transactions.map((row, index) => (
                <Item as="li" key={`${row.sourcePage}-${index}`} label={`${row.date} · ${row.description}`}
                  description={`${row.classification?.category ?? 'OTHER'} · ${row.classification?.isTransaction === false ? 'Not a transaction' : row.classification?.needsReview ? 'Needs Review' : 'Ready'}`}
                  endContent={<Text hasTabularNumbers>{formatMinorCurrencySummary(row.amountMinor, 'INR')}</Text>} />
              ))}
            </VStack>
            <ReconciliationSummary result={result.reconciliation} />
            {result.unparsedRows ? <Banner status="warning" title="Some rows need manual review" description="Rows without a reliable date or amount were not staged. Check the PDF against the reconstructed count." /> : null}
            <Button label={isStaging ? 'Staging transactions' : 'Continue to statement review'} variant="primary" isDisabled={!accountId || !result.transactions.some((row) => row.classification?.isTransaction !== false) || busy || hasActiveRows} onClick={() => void stage()} />
          </VStack>
        ) : null}
      </VStack>
    </Section>
  );
}
