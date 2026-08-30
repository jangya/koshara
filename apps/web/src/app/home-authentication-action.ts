import {Show, SignInButton} from '@clerk/nextjs';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {createElement, type ComponentProps} from 'react';

export function HomeAuthenticationAction({applicationName}: {applicationName: string}) {
  return createElement(
    Show,
    {
      when: 'signed-out',
      fallback: createElement(
        Link,
        ({
          href: '/dashboard',
          isStandalone: true,
        }) as ComponentProps<typeof Link>,
        `Open ${applicationName} dashboard`,
      ),
    },
    createElement(
      SignInButton,
      {mode: 'modal'},
      createElement(Button, {label: `Sign in to ${applicationName}`, variant: 'primary'}),
    ),
  );
}
