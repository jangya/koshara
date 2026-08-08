'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {FileInput} from '@astryxdesign/core/FileInput';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Selector} from '@astryxdesign/core/Selector';
import {VStack} from '@astryxdesign/core/Stack';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

import {createCsvImportSessionAction, type ImportActionResult} from '@/app/(app)/import-actions';

export function ImportUploadForm({accounts}: {accounts: Array<{id: string; displayName: string}>}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImportActionResult | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    const formData = new FormData();
    formData.set('financialAccountId', accountId);
    for (const file of files) formData.append('files', file);
    const nextResult = await createCsvImportSessionAction(formData);
    setResult(nextResult);
    setIsSubmitting(false);
    if (nextResult.status === 'success' && nextResult.importSessionId) {
      router.push(`/imports/${nextResult.importSessionId}`);
    }
  }

  return (
    <form onSubmit={submit}>
      <VStack gap={4}>
        {result ? <Banner status={result.status} title={result.message} /> : null}
        <FormLayout>
          <Selector
            label="Financial account"
            description="All files in this session must belong to the same account and currency."
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((account) => ({value: account.id, label: account.displayName}))}
            isRequired
            width="100%"
          />
          <FileInput
            label="CSV statements"
            description="Choose up to five CSV files. Each file may be up to 2 MB and 5,000 data rows."
            value={files}
            onChange={(value) => setFiles(Array.isArray(value) ? value : value ? [value] : [])}
            accept=".csv,text/csv"
            isMultiple
            maxFiles={5}
            maxSize={2 * 1024 * 1024}
            mode="dropzone"
            isRequired
            width="100%"
          />
        </FormLayout>
        <Button
          label="Upload and map columns"
          type="submit"
          variant="primary"
          isDisabled={!accountId || files.length === 0}
          isLoading={isSubmitting}
        />
      </VStack>
    </form>
  );
}
