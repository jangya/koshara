'use client';

import {ClerkProvider} from '@clerk/nextjs';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useState, type ReactNode} from 'react';

export function Providers({children}: {children: ReactNode}) {
  const [queryClient] = useState(() => new QueryClient());
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const content = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

  if (!publishableKey) {
    return content;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} dynamic>
      {content}
    </ClerkProvider>
  );
}
