import type {Metadata} from 'next';
import {FeatureEmptyState} from '@/components/feature-empty-state';
import {Page} from '@/components/page';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Transactions'};

export default async function TransactionsPage() {
  await getHouseholdPageContext();
  return <Page title="Transactions"><FeatureEmptyState title="No transactions yet" description="Transactions will appear only after a reviewed import is committed in Milestone 2." /></Page>;
}
