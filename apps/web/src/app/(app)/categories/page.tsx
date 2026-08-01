import type {Metadata} from 'next';
import {FeatureEmptyState} from '@/components/feature-empty-state';
import {Page} from '@/components/page';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Categories'};

export default async function CategoriesPage() {
  await getHouseholdPageContext();
  return <Page title="Categories"><FeatureEmptyState title="Category management arrives with household intelligence" description="No transaction categories are seeded as financial data in Milestone 1." /></Page>;
}
