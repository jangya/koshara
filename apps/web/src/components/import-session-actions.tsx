'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

import {
  commitCsvImportSessionAction,
  rollbackCsvImportSessionAction,
  type ImportActionResult,
} from '@/app/(app)/import-actions';

export function ImportSessionActions({importSessionId, status, pendingDuplicates}: {
  importSessionId: string;
  status: 'review' | 'committed';
  pendingDuplicates: number;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ImportActionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function commit() {
    setIsSubmitting(true);
    const nextResult = await commitCsvImportSessionAction({importSessionId});
    setResult(nextResult);
    setIsSubmitting(false);
    router.refresh();
  }

  async function rollback() {
    if (!window.confirm('Roll back this entire import? Every transaction committed by it will be removed.')) return;
    setIsSubmitting(true);
    const nextResult = await rollbackCsvImportSessionAction({importSessionId});
    setResult(nextResult);
    setIsSubmitting(false);
    if (nextResult.status === 'success') router.refresh();
  }

  return (
    <VStack gap={3}>
      {result ? <Banner status={result.status} title={result.message} /> : null}
      {status === 'review' && pendingDuplicates > 0 ? (
        <Banner
          status="warning"
          title={`${pendingDuplicates} duplicate decision${pendingDuplicates === 1 ? '' : 's'} required`}
          description="Choose Include or Skip for every exact and probable duplicate before committing."
        />
      ) : null}
      <HStack gap={3} wrap="wrap">
        {status === 'review' ? (
          <Button
            label="Commit included transactions"
            variant="primary"
            onClick={commit}
            isDisabled={pendingDuplicates > 0}
            isLoading={isSubmitting}
          />
        ) : (
          <Button label="Roll back entire import" variant="destructive" onClick={rollback} isLoading={isSubmitting} />
        )}
      </HStack>
    </VStack>
  );
}
