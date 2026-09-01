'use client';

import type {ReactNode} from 'react';

import {KosharaRuntime} from '@/components/koshara-runtime';

export function Providers({children}: {children: ReactNode}) {
  return <KosharaRuntime>{children}</KosharaRuntime>;
}
