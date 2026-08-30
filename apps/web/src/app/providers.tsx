'use client';

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useState, type ReactNode} from 'react';

import {KosharaRuntime} from '@/components/koshara-runtime';

export function Providers({children}: {children: ReactNode}) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <KosharaRuntime>{children}</KosharaRuntime>
    </QueryClientProvider>
  );
}
