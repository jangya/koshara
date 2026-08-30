'use client';

import {useEffect, type ReactNode} from 'react';

import {hydrateKosharaStore} from '@/lib/koshara-store';

import {WebMCPTools} from './webmcp-tools';

export function KosharaRuntime({children}: {children: ReactNode}) {
  useEffect(() => hydrateKosharaStore(), []);
  return <>{children}<WebMCPTools /></>;
}
