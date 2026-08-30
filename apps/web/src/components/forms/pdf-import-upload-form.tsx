'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {FileInput} from '@astryxdesign/core/FileInput';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Selector} from '@astryxdesign/core/Selector';
import {VStack} from '@astryxdesign/core/Stack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

import {createPdfImportSessionAction, type ImportActionResult} from '@/app/(app)/import-actions';

export function PdfImportUploadForm({accounts}: {accounts: Array<{id: string; displayName: string}>}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImportActionResult | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setIsSubmitting(true);
    setResult(null);
    const formData = new FormData();
    formData.set('financialAccountId', accountId);
    formData.set('file', file);
    if (password) formData.set('password', password);
    try {
      const nextResult = await createPdfImportSessionAction(formData);
      setResult(nextResult);
      if (nextResult.status === 'success' && nextResult.importSessionId) {
        router.push(`/imports/${nextResult.importSessionId}`);
      }
    } catch {
      setResult({status: 'error', message: 'The PDF statement could not be imported'});
    } finally {
      setPassword('');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <VStack gap={4}>
        {result ? <Banner status={result.status} title={result.message} /> : null}
        <FormLayout>
          <Selector
            label="Financial account"
            description="The extracted statement rows use this account and currency."
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((account) => ({value: account.id, label: account.displayName}))}
            isRequired
            width="100%"
          />
          <FileInput
            label="PDF statement"
            description="Choose one text-based PDF up to 10 MB and 100 pages. The original is stored privately."
            value={file}
            onChange={(value) => setFile(Array.isArray(value) ? (value[0] ?? null) : value)}
            accept=".pdf,application/pdf"
            maxSize={10 * 1024 * 1024}
            mode="dropzone"
            isRequired
            width="100%"
          />
          <TextInput
            label="PDF password"
            description="Optional. Used only during this upload and never stored or logged."
            type="password"
            value={password}
            onChange={setPassword}
            isOptional
            width="100%"
          />
        </FormLayout>
        <Button
          label="Store, extract, and map PDF"
          type="submit"
          variant="primary"
          isDisabled={!accountId || !file}
          isLoading={isSubmitting}
        />
      </VStack>
    </form>
  );
}
