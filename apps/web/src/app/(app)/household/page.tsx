import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import type {Metadata} from 'next';

import {InviteForm} from '@/components/forms/invite-form';
import {Page} from '@/components/page';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Household'};

export default async function HouseholdPage() {
  const context = await getHouseholdPageContext();
  const isOwner = context.role === 'org:admin';

  return (
    <Page title="Household" description="Clerk Organisation membership controls access to this household.">
      <VStack gap={6}>
        <Section>
          <VStack gap={2}>
            <Heading level={2}>{context.household.name}</Heading>
            <Text color="secondary">Base currency: {context.household.baseCurrency}</Text>
            <Text color="secondary">Financial year starts in month {context.household.financialYearStartMonth}.</Text>
            <Text color="secondary">Your role: {isOwner ? 'Household owner' : 'Household member'}</Text>
          </VStack>
        </Section>
        <Section>
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Invite the second member</Heading>
              <Text color="secondary">Invitations grant the basic Clerk organisation member role.</Text>
            </VStack>
            {isOwner ? (
              <InviteForm />
            ) : (
              <Text color="secondary">Only the household owner can send invitations.</Text>
            )}
          </VStack>
        </Section>
      </VStack>
    </Page>
  );
}
