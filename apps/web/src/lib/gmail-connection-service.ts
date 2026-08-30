import {getGmailProfileEmail, revokeGoogleToken} from './gmail-api';
import {
  exchangeGoogleAuthorizationCode,
  GMAIL_READONLY_SCOPE,
  refreshGoogleAccessToken,
  type GoogleOAuthEnvironment,
} from './google-oauth';
import {decryptGmailToken, encryptGmailToken} from './gmail-token-crypto';

export type GmailConnectionErrorCode =
  | 'GMAIL_CONNECTION_INACTIVE'
  | 'GMAIL_ACCOUNT_MISMATCH'
  | 'GMAIL_CONNECTION_FAILED';

export class GmailConnectionError extends Error {
  readonly code: GmailConnectionErrorCode;

  constructor(code: GmailConnectionErrorCode, message: string) {
    super(message);
    this.name = 'GmailConnectionError';
    this.code = code;
  }
}

type StoredGmailCredentials = {
  id: string;
  encryptedAccessToken: string | null;
  encryptedRefreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  disconnectedAt: Date | null;
};

export async function getUsableGmailAccessToken(input: {
  householdId: string;
  connection: StoredGmailCredentials;
  encryptionKey: Uint8Array;
  environment: GoogleOAuthEnvironment;
  updateAccessToken(value: {encryptedAccessToken: string; accessTokenExpiresAt: Date}): Promise<unknown>;
  fetchImpl?: typeof fetch;
}) {
  const {connection} = input;
  if (
    connection.disconnectedAt
    || !connection.encryptedAccessToken
    || !connection.encryptedRefreshToken
    || !connection.accessTokenExpiresAt
  ) {
    throw new GmailConnectionError('GMAIL_CONNECTION_INACTIVE', 'Connect Gmail before discovering statements');
  }
  const context = {householdId: input.householdId, connectionId: connection.id} as const;
  try {
    if (connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
      return decryptGmailToken(connection.encryptedAccessToken, input.encryptionKey, {...context, tokenKind: 'access'});
    }
    const refreshToken = decryptGmailToken(
      connection.encryptedRefreshToken,
      input.encryptionKey,
      {...context, tokenKind: 'refresh'},
    );
    const refreshed = await refreshGoogleAccessToken({
      refreshToken,
      environment: input.environment,
      fetchImpl: input.fetchImpl,
    });
    await input.updateAccessToken({
      encryptedAccessToken: encryptGmailToken(
        refreshed.accessToken,
        input.encryptionKey,
        {...context, tokenKind: 'access'},
      ),
      accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
    });
    return refreshed.accessToken;
  } catch (error) {
    if (error instanceof GmailConnectionError) throw error;
    throw new GmailConnectionError(
      'GMAIL_CONNECTION_INACTIVE',
      'The Gmail connection needs to be authorised again',
    );
  }
}

export async function completeGmailOAuthConnection(input: {
  householdId: string;
  connectionId: string;
  clerkUserId: string;
  verifiedClerkEmails: string[];
  code: string;
  codeVerifier: string;
  encryptionKey: Uint8Array;
  environment: GoogleOAuthEnvironment;
  fetchImpl?: typeof fetch;
  saveConnection(value: {
    id: string;
    connectedByClerkUserId: string;
    emailAddress: string;
    encryptedRefreshToken: string;
    encryptedAccessToken: string;
    accessTokenExpiresAt: Date;
    scope: typeof GMAIL_READONLY_SCOPE;
  }): Promise<unknown>;
}) {
  let refreshToken: string | undefined;
  try {
    const tokens = await exchangeGoogleAuthorizationCode({
      code: input.code,
      codeVerifier: input.codeVerifier,
      environment: input.environment,
      fetchImpl: input.fetchImpl,
    });
    refreshToken = tokens.refreshToken;
    if (!refreshToken) throw new Error('refresh token missing');
    const emailAddress = await getGmailProfileEmail(tokens.accessToken, input.fetchImpl);
    const verifiedEmails = new Set(input.verifiedClerkEmails.map((email) => email.toLowerCase()));
    if (!verifiedEmails.has(emailAddress)) {
      throw new GmailConnectionError(
        'GMAIL_ACCOUNT_MISMATCH',
        'Connect the same verified Google address used for this Koshara account',
      );
    }
    const context = {householdId: input.householdId, connectionId: input.connectionId} as const;
    await input.saveConnection({
      id: input.connectionId,
      connectedByClerkUserId: input.clerkUserId,
      emailAddress,
      encryptedRefreshToken: encryptGmailToken(refreshToken, input.encryptionKey, {...context, tokenKind: 'refresh'}),
      encryptedAccessToken: encryptGmailToken(tokens.accessToken, input.encryptionKey, {...context, tokenKind: 'access'}),
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      scope: GMAIL_READONLY_SCOPE,
    });
    return emailAddress;
  } catch (error) {
    if (refreshToken) await revokeGoogleToken(refreshToken, input.fetchImpl);
    if (error instanceof GmailConnectionError) throw error;
    throw new GmailConnectionError('GMAIL_CONNECTION_FAILED', 'The Gmail connection could not be completed');
  }
}
