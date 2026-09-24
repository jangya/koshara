'use client';

import {Button} from '@astryxdesign/core/Button';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack} from '@astryxdesign/core/Stack';
import {TextArea} from '@astryxdesign/core/TextArea';
import {useState, type FormEvent} from 'react';

export function DashboardCustomizationDialog({open, onOpenChange, onApply, pending, error}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (request: string) => Promise<void>;
  pending: boolean;
  error: string | null;
}) {
  const [request, setRequest] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (request.trim().length < 3 || pending) return;
    await onApply(request.trim());
  }
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange} purpose="form" width="min(34rem, calc(100vw - var(--spacing-6)))">
      <form onSubmit={(event) => void submit(event)}>
        <Layout
          header={<DialogHeader title="Customize dashboard" subtitle="Tell Koshara which financial view matters most to you." onOpenChange={() => onOpenChange(false)} />}
          content={<LayoutContent padding={4}><FormLayout>
            <TextArea label="What would you like to see?" value={request} onChange={setRequest} maxLength={500} rows={3} width="100%" placeholder="Focus more on our savings and recent transactions" status={error ? {type: 'error', message: error} : undefined} />
          </FormLayout></LayoutContent>}
          footer={<LayoutFooter padding={3}><HStack gap={2} hAlign="end">
            <Button label="Cancel" onClick={() => onOpenChange(false)} isDisabled={pending} />
            <Button label="Apply to dashboard" variant="primary" type="submit" isLoading={pending} isDisabled={request.trim().length < 3} />
          </HStack></LayoutFooter>}
        />
      </form>
    </Dialog>
  );
}
