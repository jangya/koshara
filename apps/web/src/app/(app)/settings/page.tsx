import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import type {Metadata} from 'next';

import {Page} from '@/components/page';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Settings'};

export default async function SettingsPage() {
  const context = await getHouseholdPageContext();
  return (
    <Page title="Settings" description="Current deployment and household defaults.">
      <Section>
        <VStack gap={3}>
          <Heading level={2}>Financial defaults</Heading>
          <Text>Base currency: {context.household.baseCurrency}</Text>
          <Text>Financial year starts in month {context.household.financialYearStartMonth}.</Text>
          <Text color="secondary">Editing, export and household deletion arrive in later scoped milestones.</Text>
        </VStack>
      </Section>
    </Page>
  );
}
