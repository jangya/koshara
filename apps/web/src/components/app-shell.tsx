'use client';

import {AppShell as AstryxAppShell} from '@astryxdesign/core/AppShell';
import {SideNav, SideNavHeading, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';

const navigation = [
  {href: '/dashboard', label: 'Dashboard'},
  {href: '/transactions', label: 'Transactions'},
  {href: '/statements', label: 'Statements'},
  {href: '/accounts', label: 'Accounts'},
  {href: '/categories', label: 'Categories'},
] as const;

export function AppShell({children}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const sideNavigation = (
    <SideNav
      header={
        <SideNavHeading
          heading="Koshara"
          headingHref="/dashboard"
          subheading="Mehta household"
        />
      }
      footer={
        <VStack gap={1} padding={3}>
          <Text type="supporting" color="secondary">Local demo workspace</Text>
          <Text type="supporting" color="secondary">₹ INR · Saved on this device</Text>
        </VStack>
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
