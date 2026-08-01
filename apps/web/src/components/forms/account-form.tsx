'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Selector} from '@astryxdesign/core/Selector';
import {VStack} from '@astryxdesign/core/Stack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useState} from 'react';
import {Controller, useForm, useWatch} from 'react-hook-form';

import {createAccountAction, type ActionResult} from '@/app/(app)/actions';

type PersonOption = {id: string; displayName: string};
type AccountFormValues = {
  institutionName: string;
  displayName: string;
  accountType: 'current' | 'savings' | 'credit-card' | 'cash' | 'wallet' | 'other';
  maskedReference: string;
  currency: string;
  primaryPersonId: string;
  joint: boolean;
  additionalPersonIds: string[];
};

export function AccountForm({people}: {people: PersonOption[]}) {
  const {control, handleSubmit, reset, setValue, formState} = useForm<AccountFormValues>({
    defaultValues: {
      institutionName: '',
      displayName: '',
      accountType: 'savings',
      maskedReference: '',
      currency: 'INR',
      primaryPersonId: people[0]?.id ?? '',
      joint: false,
      additionalPersonIds: [],
    },
  });
  const [result, setResult] = useState<ActionResult | null>(null);
  const joint = useWatch({control, name: 'joint'});
  const primaryPersonId = useWatch({control, name: 'primaryPersonId'});
  const additionalPersonIds = useWatch({control, name: 'additionalPersonIds'});

  async function submit(values: AccountFormValues) {
    const nextResult = await createAccountAction(values);
    setResult(nextResult);
    if (nextResult.status === 'success') {
      reset({...values, institutionName: '', displayName: '', maskedReference: '', additionalPersonIds: []});
    }
  }

  function setJoint(value: boolean) {
    setValue('joint', value);
    if (!value) setValue('additionalPersonIds', []);
  }

  function setAdditionalPerson(personId: string, selected: boolean) {
    setValue(
      'additionalPersonIds',
      selected
        ? [...new Set([...additionalPersonIds, personId])]
        : additionalPersonIds.filter((id) => id !== personId),
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <VStack gap={4}>
        {result ? <Banner status={result.status} title={result.message} /> : null}
        <FormLayout>
          <Controller
            control={control}
            name="institutionName"
            rules={{required: 'Enter the institution name'}}
            render={({field, fieldState}) => (
              <TextInput
                label="Institution"
                value={field.value}
                onChange={field.onChange}
                isRequired
                width="100%"
                status={fieldState.error ? {type: 'error', message: fieldState.error.message} : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="displayName"
            rules={{required: 'Enter an account display name'}}
            render={({field, fieldState}) => (
              <TextInput
                label="Account name"
                value={field.value}
                onChange={field.onChange}
                isRequired
                width="100%"
                status={fieldState.error ? {type: 'error', message: fieldState.error.message} : undefined}
              />
            )}
          />
          <FormLayout direction="horizontal">
            <Controller
              control={control}
              name="accountType"
              render={({field}) => (
                <Selector
                  label="Account type"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    {value: 'current', label: 'Current'},
                    {value: 'savings', label: 'Savings'},
                    {value: 'credit-card', label: 'Credit card'},
                    {value: 'cash', label: 'Cash'},
                    {value: 'wallet', label: 'Wallet'},
                    {value: 'other', label: 'Other'},
                  ]}
                  width="100%"
                />
              )}
            />
            <Controller
              control={control}
              name="currency"
              rules={{required: 'Enter a currency code', pattern: {value: /^[A-Za-z]{3}$/u, message: 'Use a three-letter code'}}}
              render={({field, fieldState}) => (
                <TextInput
                  label="Currency"
                  value={field.value}
                  onChange={field.onChange}
                  isRequired
                  width="100%"
                  status={fieldState.error ? {type: 'error', message: fieldState.error.message} : undefined}
                />
              )}
            />
          </FormLayout>
          <Controller
            control={control}
            name="maskedReference"
            render={({field}) => (
              <TextInput
                label="Masked reference"
                description="Optional. Use only a masked value or the last four digits."
                value={field.value}
                onChange={field.onChange}
                isOptional
                width="100%"
              />
            )}
          />
          <Controller
            control={control}
            name="primaryPersonId"
            rules={{required: 'Choose a primary holder'}}
            render={({field, fieldState}) => (
              <Selector
                label="Primary holder"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  setValue('additionalPersonIds', additionalPersonIds.filter((id) => id !== value));
                }}
                options={people.map((person) => ({value: person.id, label: person.displayName}))}
                isRequired
                width="100%"
                status={fieldState.error ? {type: 'error', message: fieldState.error.message} : undefined}
              />
            )}
          />
          <CheckboxInput
            label="Joint account"
            description="Add one or more additional household holders."
            value={joint}
            onChange={setJoint}
          />
          {joint ? (
            <fieldset>
              <legend>Additional holders</legend>
              <VStack gap={2}>
                {people
                  .filter((person) => person.id !== primaryPersonId)
                  .map((person) => (
                    <CheckboxInput
                      key={person.id}
                      label={person.displayName}
                      value={additionalPersonIds.includes(person.id)}
                      onChange={(selected) => setAdditionalPerson(person.id, selected)}
                    />
                  ))}
              </VStack>
            </fieldset>
          ) : null}
        </FormLayout>
        <Button label="Add account" type="submit" variant="primary" isLoading={formState.isSubmitting} />
      </VStack>
    </form>
  );
}
