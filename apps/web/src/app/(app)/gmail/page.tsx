import type {Metadata} from 'next';
import {FeatureEmptyState} from '@/components/feature-empty-state';
import {Page} from '@/components/page';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Gmail'};

export default async function GmailPage() {
  await getHouseholdPageContext();
  return <Page title="Gmail"><FeatureEmptyState title="Gmail is not connected" description="Separate read-only Google OAuth and manual statement discovery are intentionally deferred until file imports are stable." /></Page>;
}
