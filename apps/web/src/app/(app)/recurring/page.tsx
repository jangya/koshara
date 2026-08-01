import type {Metadata} from 'next';
import {FeatureEmptyState} from '@/components/feature-empty-state';
import {Page} from '@/components/page';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Recurring'};

export default async function RecurringPage() {
  await getHouseholdPageContext();
  return <Page title="Recurring"><FeatureEmptyState title="No recurring expenses confirmed" description="Suggestions will be calculated from real committed expenses and always require confirmation." /></Page>;
}
