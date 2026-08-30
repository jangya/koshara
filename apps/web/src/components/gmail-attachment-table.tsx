'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Selector} from '@astryxdesign/core/Selector';
import {VStack} from '@astryxdesign/core/Stack';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Token} from '@astryxdesign/core/Token';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

import {importGmailAttachmentAction, type GmailActionResult} from '@/app/(app)/gmail/gmail-actions';

export interface GmailAttachmentRow extends Record<string, unknown> {
  id: string;
  filename: string;
  received: string;
  size: string;
  status: 'discovered' | 'importing' | 'imported';
  importSessionId: string | null;
}

const statusPresentation = {
  discovered: {label: 'Ready', color: 'blue'},
  importing: {label: 'Importing', color: 'yellow'},
  imported: {label: 'Imported', color: 'green'},
} as const;

function GmailAttachmentImport({row, accounts, isConnectionActive}: {
  row: GmailAttachmentRow;
  accounts: Array<{id: string; displayName: string}>;
  isConnectionActive: boolean;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<GmailActionResult | null>(null);

  if (row.status === 'imported' && row.importSessionId) {
    return <Link href={`/imports/${row.importSessionId}`} isStandalone>View import</Link>;
  }
  if (row.status === 'importing') return <Token label="Operator review" color="yellow" size="sm" />;
  if (!isConnectionActive) return <Token label="Reconnect required" color="gray" size="sm" />;
  if (accounts.length === 0) return <Link href="/accounts" isStandalone>Add an account</Link>;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    const formData = new FormData();
    formData.set('gmailAttachmentId', row.id);
    formData.set('financialAccountId', accountId);
    if (password) formData.set('password', password);
    try {
      const nextResult = await importGmailAttachmentAction(formData);
      setResult(nextResult);
      if (nextResult.status === 'success' && nextResult.importSessionId) {
        router.push(`/imports/${nextResult.importSessionId}`);
      }
    } catch {
      setResult({status: 'error', message: 'The Gmail statement could not be imported'});
    } finally {
      setPassword('');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <VStack gap={2}>
        {result ? <Banner status={result.status} title={result.message} /> : null}
        <Selector
          label={`Financial account for ${row.filename}`}
          isLabelHidden
          value={accountId}
          onChange={setAccountId}
          options={accounts.map((account) => ({value: account.id, label: account.displayName}))}
          isRequired
          width="100%"
        />
        <TextInput
          label={`Optional PDF password for ${row.filename}`}
          isLabelHidden
          placeholder="PDF password (optional)"
          type="password"
          value={password}
          onChange={setPassword}
          isOptional
          width="100%"
        />
        <Button label="Import PDF" type="submit" variant="primary" size="sm" isLoading={isSubmitting} />
      </VStack>
    </form>
  );
}

export function GmailAttachmentTable({attachments, accounts, isConnectionActive}: {
  attachments: GmailAttachmentRow[];
  accounts: Array<{id: string; displayName: string}>;
  isConnectionActive: boolean;
}) {
  const columns: TableColumn<GmailAttachmentRow>[] = [
    {key: 'received', header: 'Received', width: pixel(130)},
    {key: 'filename', header: 'PDF attachment', width: proportional(2)},
    {key: 'size', header: 'Size', width: pixel(100), align: 'end'},
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (row) => {
        const presentation = statusPresentation[row.status];
        return <Token label={presentation.label} color={presentation.color} size="sm" />;
      },
    },
    {
      key: 'id',
      header: 'Manual import',
      width: proportional(2),
      renderCell: (row) => (
        <GmailAttachmentImport row={row} accounts={accounts} isConnectionActive={isConnectionActive} />
      ),
    },
  ];

  return (
    <Table
      data={attachments}
      columns={columns}
      idKey="id"
      density="compact"
      verticalAlign="top"
      dividers="rows"
      textOverflow="wrap"
      rowCount={attachments.length}
    />
  );
}
