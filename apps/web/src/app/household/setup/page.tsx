import {CreateOrganization} from '@clerk/nextjs';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

import {getAllowedPageUser} from '@/lib/page-access';

export const dynamic = 'force-dynamic';

export default async function HouseholdSetupPage() {
  await getAllowedPageUser();

  return (
    <AppShell contentPadding={6} height="fill" variant="surface">
      <Section variant="transparent" maxWidth="42rem">
        <VStack gap={5}>
          <VStack gap={2}>
            <Heading level={1}>Create your household</Heading>
            <Text color="secondary">
              A Clerk Organisation represents one private household. You will be its owner and can invite the second member next.
            </Text>
          </VStack>
          <CreateOrganization afterCreateOrganizationUrl="/dashboard" skipInvitationScreen />
        </VStack>
      </Section>
    </AppShell>
  );
}
