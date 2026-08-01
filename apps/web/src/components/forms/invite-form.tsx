'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {VStack} from '@astryxdesign/core/Stack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useState} from 'react';
import {Controller, useForm} from 'react-hook-form';

import {inviteHouseholdMemberAction, type ActionResult} from '@/app/(app)/actions';

export function InviteForm() {
  const {control, handleSubmit, reset, formState} = useForm<{emailAddress: string}>({
    defaultValues: {emailAddress: ''},
  });
  const [result, setResult] = useState<ActionResult | null>(null);

  async function submit(values: {emailAddress: string}) {
    const nextResult = await inviteHouseholdMemberAction(values);
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
            name="emailAddress"
            rules={{required: 'Enter an email address'}}
            render={({field, fieldState}) => (
              <TextInput
                type="email"
                label="Email address"
                description="The address must also be present in ALLOWED_USER_EMAILS."
                value={field.value}
                onChange={field.onChange}
                isRequired
                width="100%"
                status={fieldState.error ? {type: 'error', message: fieldState.error.message} : undefined}
              />
            )}
          />
        </FormLayout>
        <Button label="Send invitation" type="submit" variant="primary" isLoading={formState.isSubmitting} />
      </VStack>
    </form>
  );
}
