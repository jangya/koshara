import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, rm, stat, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {pdfImportLimits} from './pdf-import';
import {createLocalDocumentStorage, createR2DocumentStorage} from './private-document-storage';

const accountId = 'a'.repeat(32);
const key = 'households/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/statements/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf';

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('R2 private document storage', () => {
  beforeEach(() => {
    vi.stubEnv('R2_ACCOUNT_ID', accountId);
    vi.stubEnv('R2_ACCESS_KEY_ID', 'test_access_key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test_secret_key');
    vi.stubEnv('R2_BUCKET_NAME', 'koshara-private-statements');
    vi.stubEnv('R2_ENDPOINT', `https://${accountId}.r2.cloudflarestorage.com`);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('uses only private object commands and never exposes an object URL', async () => {
    const commands: unknown[] = [];
    const options: unknown[] = [];
    const client = {
      async send(command: unknown, sendOptions: unknown) {
        commands.push(command);
        options.push(sendOptions);
        if (command instanceof GetObjectCommand) {
          const bytes = new Uint8Array([1, 2, 3, 4, 5]);
          return {
            ContentLength: 5,
            Body: {
              transformToWebStream: () => new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              }),
            },
          };
        }
        return {};
      },
    } as unknown as S3Client;
    const storage = createR2DocumentStorage(client);

    const uploadBytes = new Uint8Array([1, 2, 3]);
    await storage.put({key, bytes: uploadBytes, contentType: 'application/pdf', checksumSha256: sha256(uploadBytes)});
    await expect(storage.get(key)).resolves.toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    await storage.remove(key);

    expect(commands[0]).toBeInstanceOf(PutObjectCommand);
    expect((commands[0] as PutObjectCommand).input).toMatchObject({
      Bucket: 'koshara-private-statements',
      Key: key,
      ContentType: 'application/pdf',
    });
    expect((commands[0] as PutObjectCommand).input).not.toHaveProperty('ACL');
    expect(commands[1]).toBeInstanceOf(GetObjectCommand);
    expect(commands[2]).toBeInstanceOf(DeleteObjectCommand);
    expect(options).toHaveLength(3);
    for (const sendOptions of options) {
      expect(sendOptions).toMatchObject({abortSignal: expect.any(AbortSignal)});
    }
    expect(Object.keys(storage).sort()).toEqual(['get', 'put', 'remove']);
  });

  it('rejects keys outside the private statement namespace', async () => {
    const storage = createR2DocumentStorage({send: vi.fn()} as unknown as S3Client);
    await expect(storage.get('https://public.example/statement.pdf')).rejects.toThrow('Invalid private statement object key');
  });

  it('bounds streamed downloads even when the provider omits content length', async () => {
    const client = {
      async send(command: unknown) {
        if (!(command instanceof GetObjectCommand)) return {};
        return {
          Body: {
            transformToWebStream: () => new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(pdfImportLimits.maxBytes));
                controller.enqueue(new Uint8Array([1]));
                controller.close();
              },
            }),
          },
        };
      },
    } as unknown as S3Client;

    await expect(createR2DocumentStorage(client).get(key)).rejects.toThrow('exceeds');
  });
});

describe('local private document storage', () => {
  let storageRoot: string;

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'koshara-private-documents-'));
  });

  afterEach(async () => {
    await rm(storageRoot, {recursive: true, force: true});
  });

  it('returns identical synthetic bytes after put and removes them', async () => {
    const storage = createLocalDocumentStorage(storageRoot);
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

    await storage.put({key, bytes, contentType: 'application/pdf', checksumSha256: sha256(bytes)});
    await expect(storage.get(key)).resolves.toEqual(bytes);

    await storage.remove(key);
    await expect(storage.get(key)).rejects.toThrow('Private statement object was not found');
  });

  it('treats removing a missing object as a safe no-op', async () => {
    const storage = createLocalDocumentStorage(storageRoot);

    await expect(storage.remove(key)).resolves.toBeUndefined();
  });

  it.each([
    '../statement.pdf',
    '/tmp/statement.pdf',
    'households/not-a-uuid/statements/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf',
    'households/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/statements/not-a-uuid.pdf',
    `households/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/statements/${'b'.repeat(36)}.pdf\0`,
  ])('rejects an invalid or traversal key: %s', async (invalidKey) => {
    const storage = createLocalDocumentStorage(storageRoot);

    await expect(storage.get(invalidKey)).rejects.toThrow('Invalid private statement object key');
  });

  it('rejects a checksum mismatch without creating an object', async () => {
    const storage = createLocalDocumentStorage(storageRoot);
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(storage.put({
      key,
      bytes,
      contentType: 'application/pdf',
      checksumSha256: '0'.repeat(64),
    })).rejects.toThrow('checksum');
    await expect(storage.get(key)).rejects.toThrow('Private statement object was not found');
  });

  it('rejects writes larger than the existing PDF limit', async () => {
    const storage = createLocalDocumentStorage(storageRoot);
    const bytes = new Uint8Array(pdfImportLimits.maxBytes + 1);

    await expect(storage.put({key, bytes, contentType: 'application/pdf', checksumSha256: sha256(bytes)}))
      .rejects.toThrow('exceeds');
  });

  it('uses bounded reads and rejects an oversized stored object', async () => {
    const objectPath = join(storageRoot, key);
    await mkdir(join(objectPath, '..'), {recursive: true});
    await writeFile(objectPath, new Uint8Array(pdfImportLimits.maxBytes + 1));

    await expect(createLocalDocumentStorage(storageRoot).get(key)).rejects.toThrow('exceeds');
  });

  it('does not overwrite an existing object', async () => {
    const storage = createLocalDocumentStorage(storageRoot);
    const originalBytes = new Uint8Array([1, 2, 3]);
    const replacementBytes = new Uint8Array([4, 5, 6]);
    await storage.put({key, bytes: originalBytes, contentType: 'application/pdf', checksumSha256: sha256(originalBytes)});

    await expect(storage.put({
      key,
      bytes: replacementBytes,
      contentType: 'application/pdf',
      checksumSha256: sha256(replacementBytes),
    })).rejects.toThrow('already exists');
    await expect(storage.get(key)).resolves.toEqual(originalBytes);
  });

  it('restricts created directory and file permissions where supported', async () => {
    const storage = createLocalDocumentStorage(storageRoot);
    const bytes = new Uint8Array([1, 2, 3]);
    await storage.put({key, bytes, contentType: 'application/pdf', checksumSha256: sha256(bytes)});

    if (process.platform !== 'win32') {
      expect((await stat(join(storageRoot, 'households'))).mode & 0o777).toBe(0o700);
      expect((await stat(join(storageRoot, key))).mode & 0o777).toBe(0o600);
    }
  });

  it('rejects symlinks inside the storage tree', async () => {
    const outsideRoot = await mkdtemp(join(tmpdir(), 'koshara-private-documents-outside-'));
    await symlink(outsideRoot, join(storageRoot, 'households'));

    try {
      await expect(createLocalDocumentStorage(storageRoot).get(key)).rejects.toThrow(/symbolic link/iu);
    } finally {
      await rm(outsideRoot, {recursive: true, force: true});
    }
  });
});

describe('configured private document storage', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('selects local storage without requiring R2 configuration', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'koshara-private-documents-configured-'));
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DOCUMENT_STORAGE_DRIVER', 'local');
    vi.stubEnv('LOCAL_DOCUMENT_STORAGE_PATH', storageRoot);
    for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT']) {
      vi.stubEnv(name, '');
    }

    try {
      vi.resetModules();
      const {getPrivateDocumentStorage} = await import('./private-document-storage');
      expect(Object.keys(getPrivateDocumentStorage()).sort()).toEqual(['get', 'put', 'remove']);
    } finally {
      await rm(storageRoot, {recursive: true, force: true});
    }
  });

  it('rejects local storage in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DOCUMENT_STORAGE_DRIVER', 'local');
    vi.stubEnv('LOCAL_DOCUMENT_STORAGE_PATH', join(tmpdir(), 'koshara-private-documents-production'));
    vi.resetModules();
    const {createLocalDocumentStorage, getPrivateDocumentStorage} = await import('./private-document-storage');

    expect(() => getPrivateDocumentStorage()).toThrow('development or test');
    expect(() => createLocalDocumentStorage(join(tmpdir(), 'koshara-private-documents-production')))
      .toThrow('development or test');
  });
});
