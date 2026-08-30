import {describe, expect, it, vi} from 'vitest';

import {
  discoverGmailPdfAttachments,
  downloadGmailPdfAttachment,
  getGmailProfileEmail,
  GmailApiError,
  revokeGoogleToken,
} from './gmail-api';

const accessToken = 'synthetic-access-token';

function json(value: unknown, status = 200) {
  return Response.json(value, {status});
}

describe('bounded read-only Gmail API', () => {
  it('validates the connected Gmail profile email', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://gmail.googleapis.com/gmail/v1/users/me/profile');
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${accessToken}`);
      return json({emailAddress: 'Member@Example.com', historyId: 'ignored'});
    });

    await expect(getGmailProfileEmail(accessToken, fetchImpl)).resolves.toBe('member@example.com');
  });

  it('discovers only bounded PDF attachment metadata without requesting message body data', async () => {
    const requestedUrls: URL[] = [];
    const fetchImpl = vi.fn(async (rawUrl: string | URL | Request) => {
      const url = new URL(String(rawUrl));
      requestedUrls.push(url);
      if (url.pathname.endsWith('/messages')) {
        return json({messages: [{id: 'message_1'}, {id: 'message_2'}], nextPageToken: 'not-followed'});
      }
      if (url.pathname.endsWith('/message_1')) {
        return json({
          id: 'message_1',
          internalDate: String(Date.parse('2026-08-01T00:00:00.000Z')),
          payload: {parts: [
            {partId: '1', filename: 'statement.pdf', mimeType: 'application/pdf', body: {attachmentId: 'attachment_1', size: 2_048}},
            {partId: '2', filename: 'inline.PDF', mimeType: 'application/pdf', body: {size: 1_024}},
            {partId: '3', filename: 'notes.txt', mimeType: 'text/plain', body: {size: 30}},
          ]},
        });
      }
      return json({
        id: 'message_2',
        internalDate: String(Date.parse('2026-08-02T00:00:00.000Z')),
        payload: {parts: [{
          partId: '1', filename: 'too-large.pdf', mimeType: 'application/pdf', body: {attachmentId: 'large', size: 10 * 1024 * 1024 + 1},
        }]},
      });
    });

    await expect(discoverGmailPdfAttachments({accessToken, fetchImpl})).resolves.toEqual([
      {
        gmailMessageId: 'message_1',
        gmailAttachmentId: 'attachment_1',
        gmailPartId: '1',
        originalFilename: 'statement.pdf',
        byteSize: 2_048,
        messageReceivedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
      {
        gmailMessageId: 'message_1',
        gmailAttachmentId: null,
        gmailPartId: '2',
        originalFilename: 'inline.PDF',
        byteSize: 1_024,
        messageReceivedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
    const listUrl = requestedUrls[0]!;
    expect(listUrl.searchParams.get('maxResults')).toBe('25');
    expect(listUrl.searchParams.get('q')).toBe('has:attachment filename:pdf');
    for (const url of requestedUrls.slice(1)) {
      expect(url.searchParams.get('format')).toBe('full');
      expect(url.searchParams.get('fields')).not.toMatch(/(^|[(,])data([),]|$)/u);
    }
  });

  it('downloads and strictly decodes an external attachment only after manual import', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(url).toBeDefined();
      return json({size: bytes.length, data: Buffer.from(bytes).toString('base64url')});
    });

    await expect(downloadGmailPdfAttachment({
      accessToken,
      gmailMessageId: 'message_1',
      gmailAttachmentId: 'attachment_1',
      gmailPartId: '1',
      expectedSize: bytes.length,
      fetchImpl,
    })).resolves.toEqual(bytes);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('/messages/message_1/attachments/attachment_1');
  });

  it('retrieves a bounded inline PDF by exact part id without returning other message content', async () => {
    const wanted = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 4, 5]);
    const fetchImpl = vi.fn(async () => json({
      id: 'message_inline',
      internalDate: '0',
      payload: {parts: [
        {partId: 'body', filename: '', mimeType: 'text/plain', body: {size: 5, data: 'c2VjcmV0'}},
        {partId: 'pdf', filename: 'inline.pdf', mimeType: 'application/pdf', body: {size: wanted.length, data: Buffer.from(wanted).toString('base64url')}},
      ]},
    }));

    await expect(downloadGmailPdfAttachment({
      accessToken,
      gmailMessageId: 'message_inline',
      gmailAttachmentId: null,
      gmailPartId: 'pdf',
      expectedSize: wanted.length,
      fetchImpl,
    })).resolves.toEqual(wanted);
  });

  it('bounds provider retries and replaces authentication/provider details with typed generic errors', async () => {
    const retryingFetch = vi.fn()
      .mockResolvedValueOnce(json({error: 'temporary secret'}, 503))
      .mockResolvedValueOnce(json({messages: []}));
    await expect(discoverGmailPdfAttachments({accessToken, fetchImpl: retryingFetch})).resolves.toEqual([]);
    expect(retryingFetch).toHaveBeenCalledTimes(2);

    const operation = discoverGmailPdfAttachments({
      accessToken,
      fetchImpl: vi.fn(async () => json({error: 'private provider detail'}, 401)),
    });
    await expect(operation).rejects.toEqual(new GmailApiError(
      'GMAIL_AUTH_REQUIRED',
      'The Gmail connection needs to be authorised again',
    ));
    await expect(operation).rejects.not.toThrow('private provider detail');
  });

  it('reports revocation confirmation without exposing the provider response', async () => {
    await expect(revokeGoogleToken('synthetic-refresh-token', vi.fn(async () => new Response(null, {status: 200}))))
      .resolves.toBe(true);
    await expect(revokeGoogleToken('synthetic-refresh-token', vi.fn(async () => json({error: 'private detail'}, 400))))
      .resolves.toBe(false);
  });
});
