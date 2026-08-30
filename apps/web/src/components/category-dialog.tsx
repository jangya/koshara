'use client';

import {Button} from '@astryxdesign/core/Button';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {HStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useState, type FormEvent} from 'react';

import {createCategory, updateCategory} from '@/lib/koshara-store';
import {isBudgetEligibleCategory, validateCategoryInput} from '@/lib/category-rules';
import type {Category, CategoryColor} from '@/lib/koshara-types';

const colorOptions: Array<{value: CategoryColor; label: string}> = [
  {value: 'blue', label: 'Blue'},
  {value: 'cyan', label: 'Cyan'},
  {value: 'green', label: 'Green'},
  {value: 'orange', label: 'Orange'},
  {value: 'pink', label: 'Pink'},
  {value: 'purple', label: 'Purple'},
  {value: 'red', label: 'Red'},
  {value: 'teal', label: 'Teal'},
  {value: 'yellow', label: 'Yellow'},
];

function CategoryForm({category, categories, onClose}: {category: Category | null; categories: Category[]; onClose: () => void}) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [color, setColor] = useState<CategoryColor>(category?.color ?? 'purple');
  const [budgetRupees, setBudgetRupees] = useState<number | null>(category?.budgetMinor === null || category?.budgetMinor === undefined ? null : category.budgetMinor / 100);
  const [submitError, setSubmitError] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [saving, setSaving] = useState(false);
  const budgetEligible = isBudgetEligibleCategory(name);
  const input = {
    name,
    icon,
    color,
    budgetMinor: budgetEligible && budgetRupees !== null ? Math.round(budgetRupees * 100) : null,
  };
  const validation = validateCategoryInput(input, categories, category?.id);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setShowValidation(true);
    if (validation.errors.name || validation.errors.budgetMinor) return;
    setSaving(true);
    try {
      if (category) await updateCategory(category.id, validation.value);
      else await createCategory(validation.value);
      onClose();
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : 'Could not save the category.');
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
              <TextInput
                label="Category name"
                value={name}
                onChange={setName}
                placeholder="Groceries"
                isRequired
                status={showValidation && validation.errors.name ? {type: 'error', message: validation.errors.name} : undefined}
                width="100%"
              />
              <TextInput label="Icon" value={icon} onChange={setIcon} placeholder="Optional symbol" isOptional width="100%" />
              <Selector label="Color" value={color} onChange={(value) => setColor(value as CategoryColor)} options={colorOptions} width="100%" />
              {budgetEligible ? (
                <NumberInput
                  label="Monthly spending limit"
                  description="Optional. Clear the field to remove an existing limit."
                  value={budgetRupees}
                  onChange={(value) => setBudgetRupees(value)}
                  min={0}
                  step={100}
                  units="INR"
                  hasClear
                  isOptional
                  status={showValidation && validation.errors.budgetMinor ? {type: 'error', message: validation.errors.budgetMinor} : undefined}
                  width="100%"
                />
              ) : (
                <Text type="supporting" color="secondary">Monthly spending limits are not used for Income, Transfer, or Investment.</Text>
              )}
              {submitError ? <Text type="supporting">{submitError}</Text> : null}
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

export function CategoryDialog({isOpen, onOpenChange, category, categories}: {isOpen: boolean; onOpenChange: (open: boolean) => void; category: Category | null; categories: Category[]}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width="min(30rem, calc(100vw - var(--spacing-6)))">
      {isOpen ? <CategoryForm key={category?.id ?? 'new'} category={category} categories={categories} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}
