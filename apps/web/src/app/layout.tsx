import './styles.css';

import type {Metadata} from 'next';
import type {ReactNode} from 'react';

import {Providers} from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Koshara',
    template: '%s · Koshara',
  },
  description: 'Every account. One household view.',
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
