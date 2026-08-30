import {z} from 'zod';

const gmailApiOrigin = 'https://gmail.googleapis.com';
// Gmail list/get/attachment contracts and partial-response guidance:
// https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
// https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get
// https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get
// https://developers.google.com/workspace/gmail/api/guides/performance
const revokeEndpoint = 'https://oauth2.googleapis.com/revoke';
const maxPdfBytes = 10 * 1024 * 1024;
const maxMessages = 25;
const maxAttachments = 50;
const maxPartsPerMessage = 200;
const maxMimeDepth = 10;

export type GmailApiErrorCode = 'GMAIL_PROVIDER_FAILED' | 'GMAIL_AUTH_REQUIRED' | 'GMAIL_LIMIT_EXCEEDED';

export class GmailApiError extends Error {
  readonly code: GmailApiErrorCode;

  constructor(code: GmailApiErrorCode, message: string) {
    super(message);
    this.name = 'GmailApiError';
    this.code = code;
  }
}

type FetchImplementation = typeof fetch;

const messageIdSchema = z.string().regex(/^[A-Za-z0-9._-]{1,255}$/u);
const attachmentIdSchema = z.string().regex(/^[A-Za-z0-9._-]{1,1024}$/u);
const partIdSchema = z.string().regex(/^[A-Za-z0-9._-]{1,255}$/u);
const messagePartBodySchema = z.object({
  attachmentId: attachmentIdSchema.optional(),
  size: z.number().int().min(0).max(100 * 1024 * 1024).optional(),
  data: z.string().max(15 * 1024 * 1024).optional(),
});
type MessagePart = {
  partId?: string;
  filename?: string;
  mimeType?: string;
  body?: z.infer<typeof messagePartBodySchema>;
  parts?: MessagePart[];
};
const messagePartSchema: z.ZodType<MessagePart> = z.lazy(() => z.object({
  partId: partIdSchema.optional(),
  filename: z.string().max(255).optional(),
  mimeType: z.string().max(255).optional(),
  body: messagePartBodySchema.optional(),
  parts: z.array(messagePartSchema).max(maxPartsPerMessage).optional(),
}));
const messageSchema = z.object({
  id: messageIdSchema,
  internalDate: z.string().regex(/^\d{1,20}$/u),
  payload: messagePartSchema.optional(),
});

async function readBoundedText(response: Response, maxBytes: number) {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) throw new GmailApiError(
    'GMAIL_LIMIT_EXCEEDED',
    'Gmail returned more data than the import limit allows',
  );
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let total = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new GmailApiError('GMAIL_LIMIT_EXCEEDED', 'Gmail returned more data than the import limit allows');
    }
    result += decoder.decode(value, {stream: true});
  }
  return result + decoder.decode();
}

function requestSignal(overallSignal?: AbortSignal) {
  const timeout = AbortSignal.timeout(8_000);
  return overallSignal ? AbortSignal.any([timeout, overallSignal]) : timeout;
}

async function gmailJson(input: {
  url: URL;
  accessToken: string;
  maxResponseBytes: number;
  fetchImpl?: FetchImplementation;
  overallSignal?: AbortSignal;
  retry?: boolean;
}) {
  z.string().min(1).max(8_192).parse(input.accessToken);
  const attempts = input.retry === false ? 1 : 2;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response;
    try {
      response = await (input.fetchImpl ?? fetch)(input.url, {
        headers: {Authorization: `Bearer ${input.accessToken}`, Accept: 'application/json'},
        redirect: 'error',
        signal: requestSignal(input.overallSignal),
      });
    } catch {
      if (attempt + 1 < attempts) continue;
      throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail could not be reached safely');
    }
    if (response.status === 401 || response.status === 403) {
      throw new GmailApiError('GMAIL_AUTH_REQUIRED', 'The Gmail connection needs to be authorised again');
    }
    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt + 1 < attempts) continue;
      throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail could not complete the request');
    }
    try {
      return JSON.parse(await readBoundedText(response, input.maxResponseBytes)) as unknown;
    } catch (error) {
      if (error instanceof GmailApiError) throw error;
      throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned an invalid response');
    }
  }
  throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail could not complete the request');
}

function gmailUrl(path: string, query?: Record<string, string>) {
  const url = new URL(path, gmailApiOrigin);
  if (query) url.search = new URLSearchParams(query).toString();
  return url;
}

function partFields(depth: number, includeData: boolean): string {
  const body = includeData ? 'body(attachmentId,size,data)' : 'body(attachmentId,size)';
  return depth === 0
    ? `partId,filename,mimeType,${body}`
    : `partId,filename,mimeType,${body},parts(${partFields(depth - 1, includeData)})`;
}

function flattenParts(root: MessagePart | undefined) {
  const flattened: MessagePart[] = [];
  function visit(part: MessagePart, depth: number) {
    if (depth > maxMimeDepth || flattened.length >= maxPartsPerMessage) {
      throw new GmailApiError('GMAIL_LIMIT_EXCEEDED', 'A Gmail message has too many MIME parts');
    }
    flattened.push(part);
    for (const child of part.parts ?? []) visit(child, depth + 1);
  }
  if (root) visit(root, 0);
  return flattened;
}

function validPdfPart(part: MessagePart) {
  const filename = part.filename ?? '';
  const size = part.body?.size ?? 0;
  return part.mimeType?.toLowerCase() === 'application/pdf'
    && filename.length > 0
    && filename.length <= 255
    && filename.toLowerCase().endsWith('.pdf')
    && !/[/\\\u0000-\u001f\u007f]/u.test(filename)
    && Boolean(part.partId)
    && size > 0
    && size <= maxPdfBytes;
}

export async function getGmailProfileEmail(accessToken: string, fetchImpl?: FetchImplementation) {
  const response = await gmailJson({
    url: gmailUrl('/gmail/v1/users/me/profile'),
    accessToken,
    maxResponseBytes: 64 * 1024,
    fetchImpl,
    retry: false,
  });
  const profile = z.object({emailAddress: z.email().max(254)}).safeParse(response);
  if (!profile.success) throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned an invalid account profile');
  return profile.data.emailAddress.toLowerCase();
}

export type DiscoveredGmailPdfAttachment = {
  gmailMessageId: string;
  gmailAttachmentId: string | null;
  gmailPartId: string;
  originalFilename: string;
  byteSize: number;
  messageReceivedAt: Date;
};

export async function discoverGmailPdfAttachments(input: {
  accessToken: string;
  fetchImpl?: FetchImplementation;
}): Promise<DiscoveredGmailPdfAttachment[]> {
  const overallSignal = AbortSignal.timeout(30_000);
  const listResponse = await gmailJson({
    url: gmailUrl('/gmail/v1/users/me/messages', {
      fields: 'messages(id),nextPageToken,resultSizeEstimate',
      includeSpamTrash: 'false',
      maxResults: String(maxMessages),
      q: 'has:attachment filename:pdf',
    }),
    accessToken: input.accessToken,
    maxResponseBytes: 128 * 1024,
    fetchImpl: input.fetchImpl,
    overallSignal,
  });
  const list = z.object({messages: z.array(z.object({id: messageIdSchema})).max(maxMessages).optional()}).safeParse(listResponse);
  if (!list.success) throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned an invalid message list');

  const attachments: DiscoveredGmailPdfAttachment[] = [];
  for (const listedMessage of list.data.messages ?? []) {
    const response = await gmailJson({
      url: gmailUrl(`/gmail/v1/users/me/messages/${encodeURIComponent(listedMessage.id)}`, {
        fields: `id,internalDate,payload(${partFields(maxMimeDepth, false)})`,
        format: 'full',
      }),
      accessToken: input.accessToken,
      maxResponseBytes: 512 * 1024,
      fetchImpl: input.fetchImpl,
      overallSignal,
    });
    const parsed = messageSchema.safeParse(response);
    if (!parsed.success || parsed.data.id !== listedMessage.id) {
      throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned invalid message metadata');
    }
    const receivedMilliseconds = Number(parsed.data.internalDate);
    const messageReceivedAt = new Date(receivedMilliseconds);
    if (!Number.isSafeInteger(receivedMilliseconds) || Number.isNaN(messageReceivedAt.getTime())) {
      throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned an invalid message date');
    }
    for (const part of flattenParts(parsed.data.payload)) {
      if (!validPdfPart(part)) continue;
      attachments.push({
        gmailMessageId: parsed.data.id,
        gmailAttachmentId: part.body?.attachmentId ?? null,
        gmailPartId: part.partId!,
        originalFilename: part.filename!,
        byteSize: part.body!.size!,
        messageReceivedAt,
      });
      if (attachments.length >= maxAttachments) return attachments;
    }
  }
  return attachments;
}

function decodeAttachmentData(encoded: string, expectedSize: number) {
  if (expectedSize < 1 || expectedSize > maxPdfBytes || encoded.length > Math.ceil(maxPdfBytes * 4 / 3) + 4) {
    throw new GmailApiError('GMAIL_LIMIT_EXCEEDED', 'The Gmail PDF attachment exceeds the import limit');
  }
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded)) {
    throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned invalid attachment data');
  }
  const bytes = Buffer.from(encoded, 'base64url');
  if (bytes.toString('base64url') !== encoded || bytes.byteLength !== expectedSize) {
    throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned invalid attachment data');
  }
  return new Uint8Array(bytes);
}

export async function downloadGmailPdfAttachment(input: {
  accessToken: string;
  gmailMessageId: string;
  gmailAttachmentId: string | null;
  gmailPartId: string;
  expectedSize: number;
  fetchImpl?: FetchImplementation;
}) {
  const messageId = messageIdSchema.parse(input.gmailMessageId);
  const partId = partIdSchema.parse(input.gmailPartId);
  if (input.expectedSize < 1 || input.expectedSize > maxPdfBytes) {
    throw new GmailApiError('GMAIL_LIMIT_EXCEEDED', 'The Gmail PDF attachment exceeds the import limit');
  }

  if (input.gmailAttachmentId) {
    const attachmentId = attachmentIdSchema.parse(input.gmailAttachmentId);
    const response = await gmailJson({
      url: gmailUrl(`/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`, {
        fields: 'data,size',
      }),
      accessToken: input.accessToken,
      maxResponseBytes: 15 * 1024 * 1024,
      fetchImpl: input.fetchImpl,
    });
    const attachment = z.object({size: z.number().int(), data: z.string()}).safeParse(response);
    if (!attachment.success || attachment.data.size !== input.expectedSize) {
      throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned invalid attachment data');
    }
    return decodeAttachmentData(attachment.data.data, input.expectedSize);
  }

  const response = await gmailJson({
    url: gmailUrl(`/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`, {
      fields: `id,internalDate,payload(${partFields(maxMimeDepth, true)})`,
      format: 'full',
    }),
    accessToken: input.accessToken,
    maxResponseBytes: 15 * 1024 * 1024,
    fetchImpl: input.fetchImpl,
  });
  const message = messageSchema.safeParse(response);
  if (!message.success || message.data.id !== messageId) {
    throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned invalid attachment data');
  }
  const part = flattenParts(message.data.payload).find((candidate) => candidate.partId === partId);
  if (!part || !validPdfPart(part) || part.body?.size !== input.expectedSize || !part.body.data) {
    throw new GmailApiError('GMAIL_PROVIDER_FAILED', 'Gmail returned invalid attachment data');
  }
  return decodeAttachmentData(part.body.data, input.expectedSize);
}

export async function revokeGoogleToken(token: string, fetchImpl?: FetchImplementation) {
  try {
    z.string().min(1).max(8_192).parse(token);
    const response = await (fetchImpl ?? fetch)(revokeEndpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({token}),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
