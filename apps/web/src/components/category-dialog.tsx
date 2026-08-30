'use client';

import {Button} from '@astryxdesign/core/Button';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack} from '@astryxdesign/core/Stack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useState, type FormEvent} from 'react';

import {createCategory, updateCategory} from '@/lib/koshara-store';
import type {Category} from '@/lib/koshara-types';

function CategoryForm({category, onClose}: {category: Category | null; onClose: () => void}) {
  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Enter a category name.');
      return;
    }
    setSaving(true);
    try {
      if (category) await updateCategory(category.id, {name});
      else await createCategory({name});
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Layout
        header={<DialogHeader title={category ? 'Edit category' : 'Add category'} subtitle="Use broad, reusable household finance categories." onOpenChange={onClose} />}
        content={
          <LayoutContent padding={4}>
            <FormLayout>
              <TextInput label="Category name" value={name} onChange={setName} placeholder="Groceries" isRequired status={error ? {type: 'error', message: error} : undefined} width="100%" />
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter padding={3}>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onClose} isDisabled={saving} />
              <Button label={category ? 'Save changes' : 'Add category'} variant="primary" type="submit" isLoading={saving} />
            </HStack>
          </LayoutFooter>
        }
      />
    </form>
  );
}

export function CategoryDialog({isOpen, onOpenChange, category}: {isOpen: boolean; onOpenChange: (open: boolean) => void; category: Category | null}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width="min(30rem, calc(100vw - var(--spacing-6)))">
      {isOpen ? <CategoryForm key={category?.id ?? 'new'} category={category} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}
