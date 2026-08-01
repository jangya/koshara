import {SignIn} from '@clerk/nextjs';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Banner} from '@astryxdesign/core/Banner';
import {Section} from '@astryxdesign/core/Section';

import {isAuthenticationConfigured} from '@/lib/environment';

export default function SignInPage() {
  return (
    <AppShell contentPadding={6} height="fill" variant="surface">
      <Section variant="transparent" maxWidth="32rem">
        {isAuthenticationConfigured() ? (
          <SignIn routing="path" path="/sign-in" forceRedirectUrl="/dashboard" />
        ) : (
          <Banner status="error" title="Clerk is not configured for this deployment" />
        )}
      </Section>
    </AppShell>
  );
}
