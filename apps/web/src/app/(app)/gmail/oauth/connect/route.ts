import {createGmailOAuthState, getGmailConnection} from '@koshara/database';
import {cookies} from 'next/headers';

import {requireHouseholdAccess} from '@/lib/auth';
import {getDatabase} from '@/lib/database';
import {getGmailEnvironment} from '@/lib/environment';
import {buildGoogleAuthorizationUrl} from '@/lib/google-oauth';
import {createGoogleOAuthStateMaterial, gmailOAuthStateCookieName} from '@/lib/gmail-oauth-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await requireHouseholdAccess();
    const environment = getGmailEnvironment();
    const existing = await getGmailConnection(getDatabase(), context.householdId, context.clerkUserId);
    if (existing?.disconnectedAt === null) {
      return Response.redirect(new URL('/gmail?notice=already-connected', environment.NEXT_PUBLIC_APP_URL), 303);
    }

    const state = createGoogleOAuthStateMaterial(context.householdId, environment.tokenEncryptionKey);
    await createGmailOAuthState(getDatabase(), context.householdId, {
      clerkUserId: context.clerkUserId,
      stateDigest: state.stateDigest,
      encryptedCodeVerifier: state.encryptedCodeVerifier,
      redirectUri: environment.GOOGLE_OAUTH_REDIRECT_URI,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    // Next.js 16 permits outgoing cookie mutation only from Server Functions/Route Handlers:
    // https://nextjs.org/docs/app/api-reference/functions/cookies
    const cookieStore = await cookies();
    cookieStore.set(gmailOAuthStateCookieName, state.state, {
      httpOnly: true,
      secure: new URL(environment.NEXT_PUBLIC_APP_URL).protocol === 'https:',
      sameSite: 'lax',
      path: '/gmail/oauth/callback',
      maxAge: 10 * 60,
      priority: 'high',
    });
    const authorizationUrl = buildGoogleAuthorizationUrl({
      environment,
      state: state.state,
      codeChallenge: state.codeChallenge,
      loginHint: context.user.emailAddresses[0]!,
    });
    const response = Response.redirect(authorizationUrl, 303);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch {
    return new Response(null, {status: 404, headers: {'Cache-Control': 'private, no-store'}});
  }
}
