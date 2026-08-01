import {AppShell} from '@astryxdesign/core/AppShell';
import {EmptyState} from '@astryxdesign/core/EmptyState';

export default function AccessDeniedPage() {
  return (
    <AppShell contentPadding={6} height="fill" variant="surface">
      <EmptyState
        title="This private dashboard is not available to your account"
        description="Ask the household owner to add your exact email address to ALLOWED_USER_EMAILS, then sign in again."
        headingLevel={1}
      />
    </AppShell>
  );
}
