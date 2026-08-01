import {SignInButton} from '@clerk/nextjs';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {defaultBrand} from '@koshara/ui';

import {isAuthenticationConfigured} from '@/lib/environment';

export default function HomePage() {
  const configured = isAuthenticationConfigured();

  return (
    <AppShell contentPadding={6} height="fill" variant="surface">
      <Section variant="transparent" maxWidth="42rem">
        <VStack gap={5}>
          <Text type="label" color="accent">Private household finance</Text>
          <Heading level={1} type="display-2" textWrap="balance">
            {defaultBrand.tagline}
          </Heading>
          <Text type="large" color="secondary">
            Combine household expenses securely, while keeping every account and person clearly attributed.
          </Text>
          {configured ? (
            <SignInButton mode="modal">
              <Button label={`Sign in to ${defaultBrand.applicationName}`} variant="primary" />
            </SignInButton>
          ) : (
            <Banner
              status="info"
              title="Authentication is not configured"
              description="Add the Milestone 1 environment variables before signing in."
            />
          )}
        </VStack>
      </Section>
    </AppShell>
  );
}
