'use client';

import {OrganizationSwitcher, UserButton} from '@clerk/nextjs';
import {AppShell as AstryxAppShell} from '@astryxdesign/core/AppShell';
import {SideNav, SideNavHeading, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {HStack} from '@astryxdesign/core/Stack';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';

const navigation = [
  {href: '/dashboard', label: 'Dashboard'},
  {href: '/transactions', label: 'Transactions'},
  {href: '/imports', label: 'Imports'},
  {href: '/gmail', label: 'Gmail'},
  {href: '/recurring', label: 'Recurring'},
  {href: '/categories', label: 'Categories'},
  {href: '/accounts', label: 'Accounts'},
  {href: '/household', label: 'Household'},
  {href: '/settings', label: 'Settings'},
] as const;

export function AppShell({children, householdName, applicationName}: {
  children: ReactNode;
  householdName: string;
  applicationName: string;
}) {
  const pathname = usePathname();
  const sideNavigation = (
    <SideNav
      header={
        <SideNavHeading
          heading={applicationName}
          headingHref="/dashboard"
          subheading={householdName}
        />
      }
      footer={
        <HStack gap={3} padding={3} vAlign="center">
          <OrganizationSwitcher hidePersonal />
          <UserButton />
        </HStack>
      }
      collapsible
    >
      <SideNavSection title="Household finances" isHeaderHidden>
        {navigation.map((item) => (
          <SideNavItem
            key={item.href}
            href={item.href}
            label={item.label}
            isSelected={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          />
        ))}
      </SideNavSection>
    </SideNav>
  );

  return (
    <AstryxAppShell
      sideNav={sideNavigation}
      mobileNav={{breakpoint: 'md'}}
      contentPadding={0}
      height="auto"
      variant="section"
    >
      {children}
    </AstryxAppShell>
  );
}
