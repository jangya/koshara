'use client';

import {Link} from '@astryxdesign/core/Link';
import {HStack} from '@astryxdesign/core/Stack';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {Token} from '@astryxdesign/core/Token';

export interface ImportSessionRow extends Record<string, unknown> {
  id: string;
  account: string;
  created: string;
  files: number;
  rows: number;
  status: 'mapping' | 'review' | 'committed' | 'rolled-back';
}

const statusPresentation = {
  mapping: {label: 'Needs mapping', color: 'yellow'},
  review: {label: 'Review', color: 'blue'},
  committed: {label: 'Committed', color: 'green'},
  'rolled-back': {label: 'Rolled back', color: 'gray'},
} as const;

const columns: TableColumn<ImportSessionRow>[] = [
  {key: 'created', header: 'Created', width: pixel(130)},
  {key: 'account', header: 'Account', width: proportional(2)},
  {key: 'files', header: 'Files', width: pixel(70), align: 'end'},
  {key: 'rows', header: 'Rows', width: pixel(80), align: 'end'},
  {
    key: 'status',
    header: 'Status',
    width: pixel(150),
    renderCell: (row) => {
      const presentation = statusPresentation[row.status];
      return <Token label={presentation.label} color={presentation.color} size="sm" />;
    },
  },
  {
    key: 'id',
    header: 'Next step',
    width: pixel(130),
    renderCell: (row) => (
      <HStack gap={2} hAlign="end">
        <Link href={`/imports/${row.id}`} isStandalone>
          {row.status === 'mapping' ? 'Map columns' : row.status === 'review' ? 'Review' : 'View import'}
        </Link>
      </HStack>
    ),
  },
];

export function ImportSessionTable({sessions, rowIndexStart, rowCount}: {
  sessions: ImportSessionRow[];
  rowIndexStart: number;
  rowCount: number;
}) {
  return (
    <Table
      data={sessions}
      columns={columns}
      idKey="id"
      density="compact"
      hasHover
      textOverflow="truncate"
      rowIndexStart={rowIndexStart}
      rowCount={rowCount}
    />
  );
}
