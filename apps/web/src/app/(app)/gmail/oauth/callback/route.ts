import {randomUUID} from 'node:crypto';

import {
  consumeGmailOAuthState,
  getGmailConnection,
  saveGmailConnection,
} from '@koshara/database';
import {cookies} from 'next/headers';

import {requireHouseholdAccess} from '@/lib/auth';
import {completeGmailOAuthConnection, GmailConnectionError} from '@/lib/gmail-connection-service';
import {getDatabase} from '@/lib/database';
import {getGmailEnvironment} from '@/lib/environment';
import {
  assertOAuthStateCookie,
  decryptGoogleOAuthCodeVerifier,
  digestGoogleOAuthState,
  gmailOAuthStateCookieName,
  parseGoogleOAuthCallback,
} from '@/lib/gmail-oauth-state';

export const dynamic = 'force-dynamic';

function gmailRedirect(applicationUrl: string, notice: string) {
  const url = new URL('/gmail', applicationUrl);
  url.searchParams.set('notice', notice);
  const response = Response.redirect(url, 303);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function GET(request: Request) {
  let applicationUrl: string;
  try {
    const environment = getGmailEnvironment();
    applicationUrl = environment.NEXT_PUBLIC_APP_URL;
    const callback = parseGoogleOAuthCallback(new URL(request.url), environment.GOOGLE_OAUTH_REDIRECT_URI);
    const context = await requireHouseholdAccess();
    const cookieStore = await cookies();
    const cookieState = cookieStore.get(gmailOAuthStateCookieName)?.value;
    cookieStore.set(gmailOAuthStateCookieName, '', {
      httpOnly: true,
      secure: new URL(environment.NEXT_PUBLIC_APP_URL).protocol === 'https:',
      sameSite: 'lax',
      path: '/gmail/oauth/callback',
      maxAge: 0,
      priority: 'high',
    });
    assertOAuthStateCookie(callback.state, cookieState);
    const stateDigest = digestGoogleOAuthState(callback.state);
    const state = await consumeGmailOAuthState(getDatabase(), context.householdId, {
      clerkUserId: context.clerkUserId,
      stateDigest,
      redirectUri: environment.GOOGLE_OAUTH_REDIRECT_URI,
    });
    if (!state) return gmailRedirect(applicationUrl, 'connection-failed');
    if (callback.kind === 'cancelled') return gmailRedirect(applicationUrl, 'connection-cancelled');

    const codeVerifier = decryptGoogleOAuthCodeVerifier(
      state.encryptedCodeVerifier,
      context.householdId,
      stateDigest,
      environment.tokenEncryptionKey,
    );
    const existing = await getGmailConnection(getDatabase(), context.householdId, context.clerkUserId);
    if (existing?.disconnectedAt === null) return gmailRedirect(applicationUrl, 'already-connected');
    const connectionId = existing?.id ?? randomUUID();
    await completeGmailOAuthConnection({
      householdId: context.householdId,
      connectionId,
      clerkUserId: context.clerkUserId,
      verifiedClerkEmails: context.user.emailAddresses,
      code: callback.code,
      codeVerifier,
      encryptionKey: environment.tokenEncryptionKey,
      environment,
      saveConnection: (value) => saveGmailConnection(getDatabase(), context.householdId, value),
    });
    return gmailRedirect(applicationUrl, 'connected');
  } catch (error) {
    try {
      applicationUrl ??= getGmailEnvironment().NEXT_PUBLIC_APP_URL;
      const notice = error instanceof GmailConnectionError && error.code === 'GMAIL_ACCOUNT_MISMATCH'
        ? 'account-mismatch'
        : 'connection-failed';
      return gmailRedirect(applicationUrl, notice);
    } catch {
      return new Response(null, {
        status: 404,
        headers: {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'},
      });
    }
  }
}
