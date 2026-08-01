import '@koshara/ui/styles.css';

import type {Metadata} from 'next';
import type {ReactNode} from 'react';

import {defaultBrand} from '@koshara/ui';

import {Providers} from './providers';

export const metadata: Metadata = {
  title: {
    default: defaultBrand.applicationName,
    template: `%s · ${defaultBrand.applicationName}`,
  },
  description: defaultBrand.tagline,
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
