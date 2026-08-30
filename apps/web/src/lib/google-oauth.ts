import {z} from 'zod';

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
// Google web-server OAuth parameters, exact redirects, offline refresh, and revocation:
// https://developers.google.com/identity/protocols/oauth2/web-server
// State/token-storage guidance: https://developers.google.com/identity/protocols/oauth2/resources/best-practices
const authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const providerResponseLimit = 64 * 1024;

export type GoogleOAuthEnvironment = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
};

export type GoogleOAuthErrorCode = 'OAUTH_EXCHANGE_FAILED' | 'OAUTH_REFRESH_FAILED';

export class GoogleOAuthError extends Error {
  readonly code: GoogleOAuthErrorCode;

  constructor(code: GoogleOAuthErrorCode, message: string) {
    super(message);
    this.name = 'GoogleOAuthError';
    this.code = code;
  }
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1).max(8_192),
  expires_in: z.number().int().min(60).max(86_400),
  refresh_token: z.string().min(1).max(8_192).optional(),
  scope: z.string().min(1).max(1_024),
  token_type: z.literal('Bearer'),
});

async function boundedJson(response: Response) {
  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > providerResponseLimit) throw new Error('response too large');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > providerResponseLimit) throw new Error('response too large');
  return JSON.parse(text) as unknown;
}

function exactScope(value: string) {
  const scopes = value.split(/\s+/u).filter(Boolean);
  return scopes.length === 1 && scopes[0] === GMAIL_READONLY_SCOPE;
}

export function buildGoogleAuthorizationUrl(input: {
  environment: GoogleOAuthEnvironment;
  state: string;
  codeChallenge: string;
  loginHint: string;
}) {
  const state = z.string().min(32).max(512).parse(input.state);
  const codeChallenge = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/u).parse(input.codeChallenge);
  const loginHint = z.email().max(254).parse(input.loginHint).toLowerCase();
  const url = new URL(authorizationEndpoint);
  url.search = new URLSearchParams({
    access_type: 'offline',
    client_id: input.environment.GOOGLE_CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    include_granted_scopes: 'false',
    login_hint: loginHint,
    prompt: 'consent',
    redirect_uri: input.environment.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_READONLY_SCOPE,
    state,
  }).toString();
  return url;
}

async function requestToken(input: {
  body: URLSearchParams;
  errorCode: GoogleOAuthErrorCode;
  message: string;
  requireRefreshToken: boolean;
  fetchImpl?: typeof fetch;
}) {
  try {
    const response = await (input.fetchImpl ?? fetch)(tokenEndpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: input.body,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('provider rejected request');
    const parsed = tokenResponseSchema.safeParse(await boundedJson(response));
    if (!parsed.success || !exactScope(parsed.data.scope) || (input.requireRefreshToken && !parsed.data.refresh_token)) {
      throw new Error('provider returned invalid credentials');
    }
    return {
      accessToken: parsed.data.access_token,
      accessTokenExpiresAt: new Date(Date.now() + parsed.data.expires_in * 1_000),
      refreshToken: parsed.data.refresh_token,
      scope: GMAIL_READONLY_SCOPE,
    };
  } catch {
    throw new GoogleOAuthError(input.errorCode, input.message);
  }
}

export async function exchangeGoogleAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  environment: GoogleOAuthEnvironment;
  fetchImpl?: typeof fetch;
}) {
  const code = z.string().min(1).max(4_096).parse(input.code);
  const codeVerifier = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/u).parse(input.codeVerifier);
  return requestToken({
    body: new URLSearchParams({
      client_id: input.environment.GOOGLE_CLIENT_ID,
      client_secret: input.environment.GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: input.environment.GOOGLE_OAUTH_REDIRECT_URI,
    }),
    errorCode: 'OAUTH_EXCHANGE_FAILED',
    message: 'The Gmail connection could not be completed',
    requireRefreshToken: true,
    fetchImpl: input.fetchImpl,
  });
}

export async function refreshGoogleAccessToken(input: {
  refreshToken: string;
  environment: GoogleOAuthEnvironment;
  fetchImpl?: typeof fetch;
}) {
  const refreshToken = z.string().min(1).max(8_192).parse(input.refreshToken);
  return requestToken({
    body: new URLSearchParams({
      client_id: input.environment.GOOGLE_CLIENT_ID,
      client_secret: input.environment.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    errorCode: 'OAUTH_REFRESH_FAILED',
    message: 'The Gmail connection needs to be authorised again',
    requireRefreshToken: false,
    fetchImpl: input.fetchImpl,
  });
}
