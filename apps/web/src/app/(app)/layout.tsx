import {defaultBrand} from '@koshara/ui';
import type {ReactNode} from 'react';

import {AppShell} from '@/components/app-shell';
import {getHouseholdPageContext} from '@/lib/page-access';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({children}: {children: ReactNode}) {
  const context = await getHouseholdPageContext();

  return (
    <AppShell householdName={context.household.name} applicationName={defaultBrand.shortName}>
      {children}
    </AppShell>
  );
}
