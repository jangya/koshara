'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Selector} from '@astryxdesign/core/Selector';
import {VStack} from '@astryxdesign/core/Stack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useState} from 'react';
import {Controller, useForm} from 'react-hook-form';

import {createPersonAction, type ActionResult} from '@/app/(app)/actions';

type PersonFormValues = {displayName: string; type: 'member' | 'dependent' | 'other'};

export function PersonForm() {
  const {control, handleSubmit, reset, formState} = useForm<PersonFormValues>({
    defaultValues: {displayName: '', type: 'member'},
  });
  const [result, setResult] = useState<ActionResult | null>(null);

  async function submit(values: PersonFormValues) {
    const nextResult = await createPersonAction(values);
    setResult(nextResult);
    if (nextResult.status === 'success') reset();
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <VStack gap={4}>
        {result ? <Banner status={result.status} title={result.message} /> : null}
        <FormLayout>
          <Controller
            control={control}
            name="displayName"
            rules={{required: 'Enter a display name'}}
            render={({field, fieldState}) => (
              <TextInput
                label="Display name"
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
            name="type"
            render={({field}) => (
              <Selector
                label="Person type"
                value={field.value}
                onChange={(value) => field.onChange(value)}
                options={[
                  {value: 'member', label: 'Household member'},
                  {value: 'dependent', label: 'Dependent'},
                  {value: 'other', label: 'Other'},
                ]}
                width="100%"
              />
            )}
          />
        </FormLayout>
        <Button label="Add person" type="submit" variant="primary" isLoading={formState.isSubmitting} />
      </VStack>
    </form>
  );
}
