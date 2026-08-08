'use client';

import {Selector} from '@astryxdesign/core/Selector';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {Token} from '@astryxdesign/core/Token';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';

import {setCsvImportDecisionAction} from '@/app/(app)/import-actions';

export interface ImportCandidateRow extends Record<string, unknown> {
  id: string;
  source: string;
  rowNumber: number;
  date: string;
  description: string;
  amount: string;
  kind: 'invalid' | 'new' | 'exact' | 'probable';
  decision: 'pending' | 'include' | 'exclude';
  issues: string;
}

const kindPresentation = {
  invalid: {label: 'Invalid', color: 'red'},
  new: {label: 'New', color: 'green'},
  exact: {label: 'Exact duplicate', color: 'orange'},
  probable: {label: 'Probable duplicate', color: 'yellow'},
} as const;

function CandidateDecision({row, importSessionId, editable}: {
  row: ImportCandidateRow;
  importSessionId: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (row.kind === 'invalid') return <Text color="secondary">Excluded</Text>;
  if (!editable) return <Token label={row.decision === 'include' ? 'Included' : row.decision === 'exclude' ? 'Skipped' : 'Pending'} size="sm" />;

  return (
    <Selector
      label={`Decision for ${row.source}, row ${row.rowNumber}`}
      isLabelHidden
      value={row.decision === 'pending' ? '' : row.decision}
      placeholder="Choose"
      options={[
        {value: 'include', label: 'Include'},
        {value: 'exclude', label: 'Skip'},
      ]}
      onChange={(decision) => startTransition(async () => {
        setError(null);
        const result = await setCsvImportDecisionAction({
          importSessionId,
          importCandidateId: row.id,
          decision,
        });
        if (result.status === 'error') setError(result.message);
        else router.refresh();
      })}
      isDisabled={isPending}
      status={error ? {type: 'error', message: error} : undefined}
      statusVariant="detached"
      width="100%"
    />
  );
}

export function ImportCandidateTable({candidates, importSessionId, editable, rowIndexStart, rowCount}: {
  candidates: ImportCandidateRow[];
  importSessionId: string;
  editable: boolean;
  rowIndexStart: number;
  rowCount: number;
}) {
  const columns: TableColumn<ImportCandidateRow>[] = [
    {key: 'source', header: 'File', width: proportional(1)},
    {key: 'rowNumber', header: 'Row', width: pixel(70), align: 'end'},
    {key: 'date', header: 'Date', width: pixel(120)},
    {key: 'description', header: 'Description', width: proportional(2)},
    {key: 'amount', header: 'Amount', width: pixel(130), align: 'end'},
    {
      key: 'kind',
      header: 'Review status',
      width: pixel(160),
      renderCell: (row) => {
        const presentation = kindPresentation[row.kind];
        return <Token label={presentation.label} color={presentation.color} size="sm" />;
      },
    },
    {key: 'issues', header: 'Validation', width: proportional(2)},
    {
      key: 'decision',
      header: 'Decision',
      width: pixel(150),
      renderCell: (row) => <CandidateDecision row={row} importSessionId={importSessionId} editable={editable} />,
    },
  ];
  return (
    <Table
      data={candidates}
      columns={columns}
      idKey="id"
      density="compact"
      verticalAlign="top"
      dividers="rows"
      textOverflow="wrap"
      rowIndexStart={rowIndexStart}
      rowCount={rowCount}
    />
  );
}
