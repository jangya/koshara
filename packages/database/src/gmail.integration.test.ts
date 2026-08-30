import {PGlite} from '@electric-sql/pglite';
import {parseCsv} from '@koshara/domain';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import type {KosharaDatabase} from './client';
import {
  beginGmailDiscovery,
  claimGmailAttachmentForImport,
  consumeGmailOAuthState,
  createFinancialAccount,
  createGmailOAuthState,
  createHousehold,
  createImportSession,
  createPerson,
  disconnectGmailConnection,
  getGmailConnection,
  listGmailAttachments,
  releaseGmailAttachmentImport,
  saveGmailConnection,
  upsertGmailAttachments,
} from './repositories';
import * as schema from './schema';

describe('household-scoped Gmail repositories', () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let repositoryDatabase: KosharaDatabase;

  beforeEach(async () => {
    client = new PGlite();
    database = drizzle(client, {schema});
    repositoryDatabase = database as unknown as KosharaDatabase;
    await migrate(database, {migrationsFolder: new URL('../drizzle', import.meta.url).pathname});
  });

  afterEach(async () => client.close());

  async function householdAccount(suffix: string) {
    const household = await createHousehold(repositoryDatabase, {
      clerkOrganizationId: `org_gmail_${suffix}`,
      name: `${suffix} household`,
      createdByClerkUserId: `user_${suffix}`,
    });
    const person = await createPerson(repositoryDatabase, household.id, {
      displayName: `${suffix} person`,
      type: 'member',
    });
    const account = await createFinancialAccount(repositoryDatabase, household.id, {
      institutionName: 'Synthetic Bank',
      displayName: `${suffix} account`,
      accountType: 'current',
      maskedReference: undefined,
      currency: 'INR',
      primaryPersonId: person.id,
      joint: false,
      additionalPersonIds: [],
    });
    return {household, account};
  }

  async function connection(householdId: string, userId: string, suffix: string) {
    return saveGmailConnection(repositoryDatabase, householdId, {
      id: `${suffix.padEnd(8, '0')}-0000-4000-8000-000000000001`,
      connectedByClerkUserId: userId,
      emailAddress: `${suffix}@example.com`,
      encryptedRefreshToken: `v1.synthetic.refresh.${suffix}`,
      encryptedAccessToken: `v1.synthetic.access.${suffix}`,
      accessTokenExpiresAt: new Date('2026-08-09T12:00:00.000Z'),
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
    });
  }

  it('consumes OAuth state exactly once for the initiating household and Clerk user', async () => {
    const alpha = await householdAccount('state_alpha');
    const beta = await householdAccount('state_beta');
    await createGmailOAuthState(repositoryDatabase, alpha.household.id, {
      clerkUserId: 'user_alpha',
      stateDigest: 'a'.repeat(64),
      encryptedCodeVerifier: 'v1.synthetic.verifier',
      redirectUri: 'https://koshara.example/gmail/oauth/callback',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(consumeGmailOAuthState(repositoryDatabase, beta.household.id, {
      clerkUserId: 'user_alpha',
      stateDigest: 'a'.repeat(64),
      redirectUri: 'https://koshara.example/gmail/oauth/callback',
    })).resolves.toBeUndefined();
    await expect(consumeGmailOAuthState(repositoryDatabase, alpha.household.id, {
      clerkUserId: 'user_other',
      stateDigest: 'a'.repeat(64),
      redirectUri: 'https://koshara.example/gmail/oauth/callback',
    })).resolves.toBeUndefined();
    await expect(consumeGmailOAuthState(repositoryDatabase, alpha.household.id, {
      clerkUserId: 'user_alpha',
      stateDigest: 'a'.repeat(64),
      redirectUri: 'https://koshara.example/gmail/oauth/callback',
    })).resolves.toMatchObject({encryptedCodeVerifier: 'v1.synthetic.verifier'});
    await expect(consumeGmailOAuthState(repositoryDatabase, alpha.household.id, {
      clerkUserId: 'user_alpha',
      stateDigest: 'a'.repeat(64),
      redirectUri: 'https://koshara.example/gmail/oauth/callback',
    })).resolves.toBeUndefined();
  });

  it('rejects expired OAuth state', async () => {
    const {household} = await householdAccount('expired');
    await createGmailOAuthState(repositoryDatabase, household.id, {
      clerkUserId: 'user_expired',
      stateDigest: 'b'.repeat(64),
      encryptedCodeVerifier: 'v1.synthetic.verifier',
      redirectUri: 'https://koshara.example/gmail/oauth/callback',
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(consumeGmailOAuthState(repositoryDatabase, household.id, {
      clerkUserId: 'user_expired',
      stateDigest: 'b'.repeat(64),
      redirectUri: 'https://koshara.example/gmail/oauth/callback',
    })).resolves.toBeUndefined();
  });

  it('keeps encrypted connections and discovered attachment metadata isolated by household and user', async () => {
    const alpha = await householdAccount('alpha');
    const beta = await householdAccount('beta');
    const alphaConnection = await connection(alpha.household.id, 'user_alpha', 'aaaaaaaa');
    await connection(beta.household.id, 'user_beta', 'bbbbbbbb');
    await upsertGmailAttachments(repositoryDatabase, alpha.household.id, 'user_alpha', alphaConnection.id, [{
      gmailMessageId: 'message_alpha',
      gmailAttachmentId: 'attachment_alpha',
      gmailPartId: '1.2',
      originalFilename: 'statement.pdf',
      byteSize: 2_048,
      messageReceivedAt: new Date('2026-08-01T00:00:00.000Z'),
    }]);

    await expect(getGmailConnection(repositoryDatabase, alpha.household.id, 'user_alpha')).resolves.toMatchObject({
      emailAddress: 'aaaaaaaa@example.com',
      encryptedRefreshToken: 'v1.synthetic.refresh.aaaaaaaa',
    });
    await expect(getGmailConnection(repositoryDatabase, beta.household.id, 'user_alpha')).resolves.toBeUndefined();
    await expect(listGmailAttachments(repositoryDatabase, alpha.household.id, 'user_other')).resolves.toEqual([]);
    await expect(listGmailAttachments(repositoryDatabase, alpha.household.id, 'user_alpha')).resolves.toMatchObject([{
      originalFilename: 'statement.pdf',
      status: 'discovered',
    }]);
  });

  it('uses provider provenance as an idempotency key and never overwrites an imported attachment', async () => {
    const {household, account} = await householdAccount('idempotent');
    const gmailConnection = await connection(household.id, 'user_idempotent', 'cccccccc');
    const discovered = {
      gmailMessageId: 'message_1',
      gmailAttachmentId: 'attachment_1',
      gmailPartId: '2',
      originalFilename: 'august.pdf',
      byteSize: 4_096,
      messageReceivedAt: new Date('2026-08-02T00:00:00.000Z'),
    };
    await upsertGmailAttachments(repositoryDatabase, household.id, 'user_idempotent', gmailConnection.id, [discovered]);
    await upsertGmailAttachments(repositoryDatabase, household.id, 'user_idempotent', gmailConnection.id, [
      {...discovered, originalFilename: 'changed.pdf'},
    ]);
    const [attachment] = await listGmailAttachments(repositoryDatabase, household.id, 'user_idempotent');
    expect(attachment?.originalFilename).toBe('august.pdf');

    await claimGmailAttachmentForImport(repositoryDatabase, household.id, 'user_idempotent', attachment!.id);
    const session = await createImportSession(repositoryDatabase, household.id, {
      financialAccountId: account.id,
      createdByClerkUserId: 'user_idempotent',
      files: [{
        sourceType: 'pdf',
        originalFilename: 'august.pdf',
        parsedCsv: parseCsv('Date,Description,Amount\n01/08/2026,Synthetic,-10'),
        document: {
          objectKey: `households/${household.id}/statements/dddddddd-dddd-4ddd-8ddd-dddddddddddd.pdf`,
          contentType: 'application/pdf',
          byteSize: 4_096,
          checksumSha256: 'd'.repeat(64),
          pageCount: 1,
          extractedTextBytes: 64,
          gmailAttachmentId: attachment!.id,
        },
      }],
    });
    await expect(listGmailAttachments(repositoryDatabase, household.id, 'user_idempotent')).resolves.toMatchObject([{
      status: 'imported',
      importSessionId: session.id,
      originalFilename: 'august.pdf',
    }]);
    await expect(claimGmailAttachmentForImport(repositoryDatabase, household.id, 'user_idempotent', attachment!.id))
      .rejects.toThrow('not available');
  });

  it('claims and safely releases a manual import, then clears tokens on disconnect while retaining provenance', async () => {
    const {household} = await householdAccount('release');
    const gmailConnection = await connection(household.id, 'user_release', 'eeeeeeee');
    await upsertGmailAttachments(repositoryDatabase, household.id, 'user_release', gmailConnection.id, [{
      gmailMessageId: 'message_release',
      gmailAttachmentId: null,
      gmailPartId: '3',
      originalFilename: 'inline.pdf',
      byteSize: 1_024,
      messageReceivedAt: new Date('2026-08-03T00:00:00.000Z'),
    }]);
    const [attachment] = await listGmailAttachments(repositoryDatabase, household.id, 'user_release');

    await expect(claimGmailAttachmentForImport(repositoryDatabase, household.id, 'user_release', attachment!.id))
      .resolves.toMatchObject({gmailPartId: '3', status: 'importing'});
    await releaseGmailAttachmentImport(repositoryDatabase, household.id, 'user_release', attachment!.id);
    await expect(listGmailAttachments(repositoryDatabase, household.id, 'user_release')).resolves.toMatchObject([{
      status: 'discovered',
    }]);

    await disconnectGmailConnection(repositoryDatabase, household.id, 'user_release', gmailConnection.id);
    const disconnected = await getGmailConnection(repositoryDatabase, household.id, 'user_release');
    expect(disconnected).toMatchObject({
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
    });
    expect(disconnected?.disconnectedAt).toBeInstanceOf(Date);
    await expect(listGmailAttachments(repositoryDatabase, household.id, 'user_release')).resolves.toHaveLength(1);
  });

  it('rate limits explicit discovery per household connection', async () => {
    const {household} = await householdAccount('discovery_limit');
    const gmailConnection = await connection(household.id, 'user_discovery_limit', 'ffffffff');
    await upsertGmailAttachments(repositoryDatabase, household.id, 'user_discovery_limit', gmailConnection.id, [{
      gmailMessageId: 'message_stale',
      gmailAttachmentId: 'attachment_stale',
      gmailPartId: '1',
      originalFilename: 'stale.pdf',
      byteSize: 1_024,
      messageReceivedAt: new Date('2026-08-03T00:00:00.000Z'),
    }]);
    const [attachment] = await listGmailAttachments(repositoryDatabase, household.id, 'user_discovery_limit');
    await claimGmailAttachmentForImport(
      repositoryDatabase,
      household.id,
      'user_discovery_limit',
      attachment!.id,
    );
    await database.update(schema.gmailAttachments).set({
      claimedAt: new Date(Date.now() - 16 * 60_000),
    });

    await expect(beginGmailDiscovery(
      repositoryDatabase,
      household.id,
      'user_discovery_limit',
      gmailConnection.id,
    )).resolves.toMatchObject({id: gmailConnection.id});
    await expect(listGmailAttachments(repositoryDatabase, household.id, 'user_discovery_limit')).resolves.toMatchObject([{
      status: 'discovered',
    }]);
    await expect(beginGmailDiscovery(
      repositoryDatabase,
      household.id,
      'user_discovery_limit',
      gmailConnection.id,
    )).rejects.toThrow('recently');
  });
});
