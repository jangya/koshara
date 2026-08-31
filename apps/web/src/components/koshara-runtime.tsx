'use client';

import {Suspense, useEffect, type ReactNode} from 'react';

import {hydrateKosharaStore} from '@/lib/koshara-store';

import {WebMCPTools} from './webmcp-tools';

export function KosharaRuntime({children}: {children: ReactNode}) {
  useEffect(() => hydrateKosharaStore(), []);
  return <>{children}<Suspense fallback={null}><WebMCPTools /></Suspense></>;
}
