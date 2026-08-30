'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

import {
  discoverGmailStatementsAction,
  disconnectGmailAction,
  type GmailActionResult,
} from '@/app/(app)/gmail/gmail-actions';

export function GmailConnectionActions({connectionId}: {connectionId: string}) {
  const router = useRouter();
  const [result, setResult] = useState<GmailActionResult | null>(null);
  const [pendingAction, setPendingAction] = useState<'discover' | 'disconnect' | null>(null);

  async function discover() {
    setPendingAction('discover');
    setResult(null);
    const nextResult = await discoverGmailStatementsAction();
    setResult(nextResult);
    setPendingAction(null);
    router.refresh();
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Gmail and revoke its read-only access? Discovered and imported provenance will remain.')) return;
    setPendingAction('disconnect');
    setResult(null);
    const nextResult = await disconnectGmailAction({connectionId});
    setResult(nextResult);
    setPendingAction(null);
    router.refresh();
  }

  return (
    <VStack gap={3}>
      {result ? <Banner status={result.status} title={result.message} /> : null}
      <HStack gap={3} wrap="wrap">
        <Button
          label="Discover PDF statements"
          variant="primary"
          onClick={discover}
          isLoading={pendingAction === 'discover'}
          isDisabled={pendingAction !== null && pendingAction !== 'discover'}
        />
        <Button
          label="Disconnect Gmail"
          variant="destructive"
          onClick={disconnect}
          isLoading={pendingAction === 'disconnect'}
          isDisabled={pendingAction !== null && pendingAction !== 'disconnect'}
        />
      </HStack>
    </VStack>
  );
}
