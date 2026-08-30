import {and, asc, eq, gt, isNull, lt} from 'drizzle-orm';

import type {KosharaDatabase} from './client';
import {gmailAttachments, gmailConnections, gmailOauthStates, households} from './schema';

export type SaveGmailConnectionInput = {
  id: string;
  connectedByClerkUserId: string;
  emailAddress: string;
  encryptedRefreshToken: string;
  encryptedAccessToken: string;
  accessTokenExpiresAt: Date;
  scope: 'https://www.googleapis.com/auth/gmail.readonly';
};

export async function createGmailOAuthState(
  database: KosharaDatabase,
  householdId: string,
  input: {
    clerkUserId: string;
    stateDigest: string;
    encryptedCodeVerifier: string;
    redirectUri: string;
    expiresAt: Date;
  },
) {
  return database.transaction(async (transaction) => {
    const [household] = await transaction.select({id: households.id}).from(households)
      .where(eq(households.id, householdId)).for('update');
    if (!household) throw new Error('The household was not found');
    await transaction.delete(gmailOauthStates).where(and(
      eq(gmailOauthStates.householdId, householdId),
      eq(gmailOauthStates.clerkUserId, input.clerkUserId),
    ));
    const [state] = await transaction.insert(gmailOauthStates).values({householdId, ...input}).returning();
    if (!state) throw new Error('The Gmail OAuth state could not be created');
    return state;
  });
}

export async function consumeGmailOAuthState(
  database: KosharaDatabase,
  householdId: string,
  input: {clerkUserId: string; stateDigest: string; redirectUri: string},
) {
  return database.transaction(async (transaction) => {
    const [state] = await transaction.select().from(gmailOauthStates).where(and(
      eq(gmailOauthStates.householdId, householdId),
      eq(gmailOauthStates.clerkUserId, input.clerkUserId),
      eq(gmailOauthStates.stateDigest, input.stateDigest),
      eq(gmailOauthStates.redirectUri, input.redirectUri),
      isNull(gmailOauthStates.consumedAt),
      gt(gmailOauthStates.expiresAt, new Date()),
    )).for('update');
    if (!state) return undefined;
    await transaction.update(gmailOauthStates).set({consumedAt: new Date()}).where(and(
      eq(gmailOauthStates.stateDigest, state.stateDigest),
      isNull(gmailOauthStates.consumedAt),
    ));
    return state;
  });
}

export async function getGmailConnection(
  database: KosharaDatabase,
  householdId: string,
  clerkUserId: string,
) {
  return database.query.gmailConnections.findFirst({
    where: and(
      eq(gmailConnections.householdId, householdId),
      eq(gmailConnections.connectedByClerkUserId, clerkUserId),
    ),
  });
}

export async function saveGmailConnection(
  database: KosharaDatabase,
  householdId: string,
  input: SaveGmailConnectionInput,
) {
  return database.transaction(async (transaction) => {
    const [household] = await transaction.select({id: households.id}).from(households)
      .where(eq(households.id, householdId)).for('update');
    if (!household) throw new Error('The household was not found');
    const [existing] = await transaction.select().from(gmailConnections).where(and(
      eq(gmailConnections.householdId, householdId),
      eq(gmailConnections.connectedByClerkUserId, input.connectedByClerkUserId),
    )).for('update');
    if (existing && existing.disconnectedAt === null) throw new Error('Gmail is already connected');
    if (existing && existing.id !== input.id) throw new Error('The Gmail connection changed during authorisation');

    if (existing) {
      const [updated] = await transaction.update(gmailConnections).set({
        emailAddress: input.emailAddress,
        encryptedRefreshToken: input.encryptedRefreshToken,
        encryptedAccessToken: input.encryptedAccessToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        scope: input.scope,
        disconnectedAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(gmailConnections.householdId, householdId),
        eq(gmailConnections.id, existing.id),
      )).returning();
      if (!updated) throw new Error('The Gmail connection could not be updated');
      return updated;
    }

    const [created] = await transaction.insert(gmailConnections).values({householdId, ...input}).returning();
    if (!created) throw new Error('The Gmail connection could not be created');
    return created;
  });
}

export async function updateGmailConnectionAccessToken(
  database: KosharaDatabase,
  householdId: string,
  clerkUserId: string,
  connectionId: string,
  input: {encryptedAccessToken: string; accessTokenExpiresAt: Date},
) {
  const [connection] = await database.update(gmailConnections).set({...input, updatedAt: new Date()}).where(and(
    eq(gmailConnections.householdId, householdId),
    eq(gmailConnections.connectedByClerkUserId, clerkUserId),
    eq(gmailConnections.id, connectionId),
    isNull(gmailConnections.disconnectedAt),
  )).returning();
  if (!connection) throw new Error('The Gmail connection is not active');
  return connection;
}

export async function beginGmailDiscovery(
  database: KosharaDatabase,
  householdId: string,
  clerkUserId: string,
  connectionId: string,
) {
  return database.transaction(async (transaction) => {
    const [connection] = await transaction.select().from(gmailConnections).where(and(
      eq(gmailConnections.householdId, householdId),
      eq(gmailConnections.connectedByClerkUserId, clerkUserId),
      eq(gmailConnections.id, connectionId),
      isNull(gmailConnections.disconnectedAt),
    )).for('update');
    if (!connection) throw new Error('The Gmail connection is not active');
    if (connection.lastDiscoveryAt && connection.lastDiscoveryAt.getTime() > Date.now() - 60_000) {
      throw new Error('Gmail discovery was run too recently');
    }
    await transaction.update(gmailAttachments).set({
      status: 'discovered',
      claimedByClerkUserId: null,
      claimedAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(gmailAttachments.householdId, householdId),
      eq(gmailAttachments.gmailConnectionId, connectionId),
      eq(gmailAttachments.status, 'importing'),
      eq(gmailAttachments.claimedByClerkUserId, clerkUserId),
      lt(gmailAttachments.claimedAt, new Date(Date.now() - 15 * 60_000)),
      isNull(gmailAttachments.importSessionId),
    ));
    const [updated] = await transaction.update(gmailConnections).set({
      lastDiscoveryAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(gmailConnections.householdId, householdId),
      eq(gmailConnections.id, connectionId),
    )).returning();
    if (!updated) throw new Error('Gmail discovery could not be started');
    return updated;
  });
}

export async function disconnectGmailConnection(
  database: KosharaDatabase,
  householdId: string,
  clerkUserId: string,
  connectionId: string,
) {
  const [connection] = await database.update(gmailConnections).set({
    encryptedRefreshToken: null,
    encryptedAccessToken: null,
    accessTokenExpiresAt: null,
    disconnectedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(gmailConnections.householdId, householdId),
    eq(gmailConnections.connectedByClerkUserId, clerkUserId),
    eq(gmailConnections.id, connectionId),
  )).returning();
  if (!connection) throw new Error('The Gmail connection was not found');
  return connection;
}

export type DiscoveredGmailAttachmentInput = {
  gmailMessageId: string;
  gmailAttachmentId: string | null;
  gmailPartId: string;
  originalFilename: string;
  byteSize: number;
  messageReceivedAt: Date;
};

export async function upsertGmailAttachments(
  database: KosharaDatabase,
  householdId: string,
  clerkUserId: string,
  connectionId: string,
  attachments: DiscoveredGmailAttachmentInput[],
) {
  if (attachments.length > 50) throw new Error('Gmail discovery returned too many PDF attachments');
  if (attachments.length === 0) return [];
  const connection = await database.query.gmailConnections.findFirst({
    columns: {id: true},
    where: and(
      eq(gmailConnections.householdId, householdId),
      eq(gmailConnections.connectedByClerkUserId, clerkUserId),
      eq(gmailConnections.id, connectionId),
      isNull(gmailConnections.disconnectedAt),
    ),
  });
  if (!connection) throw new Error('The Gmail connection is not active');

  return database.insert(gmailAttachments).values(attachments.map((attachment) => ({
    householdId,
    gmailConnectionId: connectionId,
    ...attachment,
  }))).onConflictDoNothing({
    target: [
      gmailAttachments.householdId,
      gmailAttachments.gmailConnectionId,
      gmailAttachments.gmailMessageId,
      gmailAttachments.gmailPartId,
    ],
  }).returning();
}

export async function listGmailAttachments(
  database: KosharaDatabase,
  householdId: string,
  clerkUserId: string,
) {
  return database.select({
    id: gmailAttachments.id,
    originalFilename: gmailAttachments.originalFilename,
    byteSize: gmailAttachments.byteSize,
    messageReceivedAt: gmailAttachments.messageReceivedAt,
    status: gmailAttachments.status,
    importSessionId: gmailAttachments.importSessionId,
    createdAt: gmailAttachments.createdAt,
  }).from(gmailAttachments).innerJoin(gmailConnections, and(
    eq(gmailConnections.householdId, gmailAttachments.householdId),
    eq(gmailConnections.id, gmailAttachments.gmailConnectionId),
  )).where(and(
    eq(gmailAttachments.householdId, householdId),
    eq(gmailConnections.connectedByClerkUserId, clerkUserId),
  )).orderBy(asc(gmailAttachments.messageReceivedAt), asc(gmailAttachments.id));
}

export async function claimGmailAttachmentForImport(
  database: KosharaDatabase,
  householdId: string,
  clerkUserId: string,
  gmailAttachmentId: string,
) {
  return database.transaction(async (transaction) => {
    const [attachment] = await transaction.select({
      id: gmailAttachments.id,
      gmailConnectionId: gmailAttachments.gmailConnectionId,
      gmailMessageId: gmailAttachments.gmailMessageId,
      gmailAttachmentId: gmailAttachments.gmailAttachmentId,
      gmailPartId: gmailAttachments.gmailPartId,
      originalFilename: gmailAttachments.originalFilename,
      contentType: gmailAttachments.contentType,
      byteSize: gmailAttachments.byteSize,
      status: gmailAttachments.status,
    }).from(gmailAttachments).innerJoin(gmailConnections, and(
      eq(gmailConnections.householdId, gmailAttachments.householdId),
      eq(gmailConnections.id, gmailAttachments.gmailConnectionId),
    )).where(and(
      eq(gmailAttachments.householdId, householdId),
      eq(gmailAttachments.id, gmailAttachmentId),
      eq(gmailAttachments.status, 'discovered'),
      eq(gmailConnections.connectedByClerkUserId, clerkUserId),
      isNull(gmailConnections.disconnectedAt),
    )).for('update');
    if (!attachment) throw new Error('The Gmail attachment is not available for import');
    const [claimed] = await transaction.update(gmailAttachments).set({
      status: 'importing',
      claimedByClerkUserId: clerkUserId,
      claimedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(gmailAttachments.householdId, householdId),
      eq(gmailAttachments.id, gmailAttachmentId),
      eq(gmailAttachments.status, 'discovered'),
    )).returning();
    if (!claimed) throw new Error('The Gmail attachment is not available for import');
    return {...attachment, status: claimed.status};
  });
}

export async function releaseGmailAttachmentImport(
  database: KosharaDatabase,
  householdId: string,
  clerkUserId: string,
  gmailAttachmentId: string,
) {
  const [released] = await database.update(gmailAttachments).set({
    status: 'discovered',
    claimedByClerkUserId: null,
    claimedAt: null,
    updatedAt: new Date(),
  }).where(and(
    eq(gmailAttachments.householdId, householdId),
    eq(gmailAttachments.id, gmailAttachmentId),
    eq(gmailAttachments.status, 'importing'),
    eq(gmailAttachments.claimedByClerkUserId, clerkUserId),
  )).returning();
  if (!released) throw new Error('The Gmail attachment import claim was not found');
  return released;
}
