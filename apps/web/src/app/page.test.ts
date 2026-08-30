import {createElement, type PropsWithChildren, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const authenticationState = vi.hoisted(() => ({signedIn: false}));

vi.mock('@clerk/nextjs', () => ({
  Show: ({children, fallback, when}: PropsWithChildren<{fallback?: ReactNode; when: string}>) => {
    const conditionMatches = when === 'signed-in'
      ? authenticationState.signedIn
      : !authenticationState.signedIn;

    return conditionMatches ? children : fallback;
  },
  SignInButton: ({children}: PropsWithChildren) => children,
}));

import {HomeAuthenticationAction} from './home-authentication-action';

describe('HomeAuthenticationAction', () => {
  beforeEach(() => {
    authenticationState.signedIn = false;
  });

  it('offers sign in to signed-out visitors', () => {
    const markup = renderToStaticMarkup(createElement(HomeAuthenticationAction, {applicationName: 'Koshara'}));

    expect(markup).toContain('Sign in to Koshara');
    expect(markup).not.toContain('Open Koshara dashboard');
  });

  it('links to the dashboard instead of opening sign in for an existing session', () => {
    authenticationState.signedIn = true;

    const markup = renderToStaticMarkup(createElement(HomeAuthenticationAction, {applicationName: 'Koshara'}));

    expect(markup).toContain('href="/dashboard"');
    expect(markup).toContain('Open Koshara dashboard');
    expect(markup).not.toContain('Sign in to Koshara');
  });
});
