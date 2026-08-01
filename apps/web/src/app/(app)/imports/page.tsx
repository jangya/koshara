import type {Metadata} from 'next';
import {FeatureEmptyState} from '@/components/feature-empty-state';
import {Page} from '@/components/page';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Imports'};

export default async function ImportsPage() {
  await getHouseholdPageContext();
  return <Page title="Imports"><FeatureEmptyState title="No statement imports" description="CSV upload, candidate review, commit and rollback are scoped to Milestone 2." /></Page>;
}
