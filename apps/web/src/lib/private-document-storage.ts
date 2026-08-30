import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {createHash, timingSafeEqual} from 'node:crypto';
import {constants} from 'node:fs';
import {chmod, lstat, mkdir, open, realpath, unlink} from 'node:fs/promises';
import {isAbsolute, join, relative, sep} from 'node:path';

import {pdfImportLimits} from './pdf-import';
import {
  assertLocalDocumentStorageAllowed,
  getDocumentStorageEnvironment,
  getR2Environment,
  resolveLocalDocumentStoragePath,
} from './environment';

const storageOperationTimeoutMs = 15_000;

function storageOperationOptions() {
  return {abortSignal: AbortSignal.timeout(storageOperationTimeoutMs)};
}

export type PrivateDocumentStorage = {
  put(input: {key: string; bytes: Uint8Array; contentType: 'application/pdf'; checksumSha256: string}): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
};

const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const statementKeyPattern = new RegExp(`^households/${uuidPattern}/statements/${uuidPattern}\\.pdf$`, 'u');

function assertStatementKey(key: string) {
  if (!statementKeyPattern.test(key)) {
    throw new Error('Invalid private statement object key');
  }
}

function isWithin(parentPath: string, childPath: string) {
  const relativePath = relative(parentPath, childPath);
  return relativePath === ''
    || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
}

function isFileSystemError(error: unknown, code: string) {
  return error instanceof Error && 'code' in error && error.code === code;
}

function assertValidWrite(bytes: Uint8Array, checksumSha256: string) {
  if (bytes.byteLength > pdfImportLimits.maxBytes) {
    throw new Error('Private statement object exceeds the upload limit');
  }
  if (!/^[0-9a-f]{64}$/u.test(checksumSha256)) {
    throw new Error('Invalid private statement checksum');
  }

  const suppliedChecksum = Buffer.from(checksumSha256, 'hex');
  const actualChecksum = createHash('sha256').update(bytes).digest();
  if (!timingSafeEqual(suppliedChecksum, actualChecksum)) {
    throw new Error('Private statement checksum mismatch');
  }
}

async function readBoundedStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const boundedBytes = new Uint8Array(pdfImportLimits.maxBytes);
  let totalBytesRead = 0;

  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) return boundedBytes.slice(0, totalBytesRead);
      if (totalBytesRead + value.byteLength > pdfImportLimits.maxBytes) {
        await reader.cancel();
        throw new Error('Private statement object exceeds the download limit');
      }
      boundedBytes.set(value, totalBytesRead);
      totalBytesRead += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

type StorageRoot = {path: string; realPath: string};

async function getStorageRoot(storagePath: string, create: boolean): Promise<StorageRoot | undefined> {
  if (create) await mkdir(storagePath, {recursive: true, mode: 0o700});

  let metadata;
  try {
    metadata = await lstat(storagePath);
  } catch (error) {
    if (!create && isFileSystemError(error, 'ENOENT')) return undefined;
    throw new Error('Local private statement storage is unavailable');
  }
  if (metadata.isSymbolicLink()) throw new Error('Symbolic links are not allowed in local document storage');
  if (!metadata.isDirectory()) throw new Error('Local private statement storage is unavailable');
  if (create) await chmod(storagePath, 0o700);

  return {path: storagePath, realPath: await realpath(storagePath)};
}

async function getObjectParent(
  root: StorageRoot,
  key: string,
  create: boolean,
): Promise<string | undefined> {
  const segments = key.split('/');
  let currentPath = root.path;

  for (const segment of segments.slice(0, -1)) {
    currentPath = join(currentPath, segment);
    if (create) {
      try {
        await mkdir(currentPath, {mode: 0o700});
      } catch (error) {
        if (!isFileSystemError(error, 'EEXIST')) {
          throw new Error('Local private statement storage is unavailable');
        }
      }
    }

    let metadata;
    try {
      metadata = await lstat(currentPath);
    } catch (error) {
      if (!create && isFileSystemError(error, 'ENOENT')) return undefined;
      throw new Error('Local private statement storage is unavailable');
    }
    if (metadata.isSymbolicLink()) throw new Error('Symbolic links are not allowed in local document storage');
    if (!metadata.isDirectory()) throw new Error('Local private statement storage is unavailable');
    if (create) await chmod(currentPath, 0o700);

    const realDirectoryPath = await realpath(currentPath);
    if (!isWithin(root.realPath, realDirectoryPath)) {
      throw new Error('Local document storage path escaped its configured root');
    }
  }

  return currentPath;
}

async function assertRegularObject(objectPath: string) {
  let metadata;
  try {
    metadata = await lstat(objectPath);
  } catch (error) {
    if (isFileSystemError(error, 'ENOENT')) throw new Error('Private statement object was not found');
    throw new Error('Local private statement storage operation failed');
  }
  if (metadata.isSymbolicLink()) throw new Error('Symbolic links are not allowed in local document storage');
  if (!metadata.isFile()) throw new Error('Private statement object was not found');
}

export function createLocalDocumentStorage(configuredStoragePath: string): PrivateDocumentStorage {
  assertLocalDocumentStorageAllowed();
  const storagePath = resolveLocalDocumentStoragePath(configuredStoragePath);

  return {
    async put(input) {
      assertStatementKey(input.key);
      assertValidWrite(input.bytes, input.checksumSha256);
      const root = await getStorageRoot(storagePath, true);
      if (!root) throw new Error('Local private statement storage is unavailable');
      const parentPath = await getObjectParent(root, input.key, true);
      if (!parentPath) throw new Error('Local private statement storage is unavailable');
      const objectPath = join(parentPath, input.key.split('/').at(-1) ?? '');

      let objectHandle;
      try {
        objectHandle = await open(
          objectPath,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
        await objectHandle.writeFile(input.bytes);
        await objectHandle.sync();
        await objectHandle.chmod(0o600);
      } catch (error) {
        if (objectHandle) {
          await objectHandle.close();
          await unlink(objectPath).catch(() => undefined);
          objectHandle = undefined;
        }
        if (isFileSystemError(error, 'EEXIST')) throw new Error('Private statement object already exists');
        if (isFileSystemError(error, 'ELOOP')) {
          throw new Error('Symbolic links are not allowed in local document storage');
        }
        throw new Error('Local private statement storage operation failed');
      } finally {
        await objectHandle?.close();
      }
    },
    async get(key) {
      assertStatementKey(key);
      const root = await getStorageRoot(storagePath, false);
      if (!root) throw new Error('Private statement object was not found');
      const parentPath = await getObjectParent(root, key, false);
      if (!parentPath) throw new Error('Private statement object was not found');
      const objectPath = join(parentPath, key.split('/').at(-1) ?? '');
      await assertRegularObject(objectPath);

      let objectHandle;
      try {
        objectHandle = await open(objectPath, constants.O_RDONLY | constants.O_NOFOLLOW);
        const metadata = await objectHandle.stat();
        if (!metadata.isFile()) throw new Error('Private statement object was not found');
        if (metadata.size > pdfImportLimits.maxBytes) {
          throw new Error('Private statement object exceeds the download limit');
        }

        const boundedBytes = new Uint8Array(pdfImportLimits.maxBytes + 1);
        let totalBytesRead = 0;
        while (totalBytesRead < boundedBytes.byteLength) {
          const {bytesRead} = await objectHandle.read(
            boundedBytes,
            totalBytesRead,
            boundedBytes.byteLength - totalBytesRead,
            null,
          );
          if (bytesRead === 0) break;
          totalBytesRead += bytesRead;
        }
        if (totalBytesRead > pdfImportLimits.maxBytes) {
          throw new Error('Private statement object exceeds the download limit');
        }
        return boundedBytes.slice(0, totalBytesRead);
      } catch (error) {
        if (error instanceof Error && (
          error.message === 'Private statement object was not found'
          || error.message === 'Private statement object exceeds the download limit'
        )) throw error;
        if (isFileSystemError(error, 'ENOENT')) throw new Error('Private statement object was not found');
        if (isFileSystemError(error, 'ELOOP')) {
          throw new Error('Symbolic links are not allowed in local document storage');
        }
        throw new Error('Local private statement storage operation failed');
      } finally {
        await objectHandle?.close();
      }
    },
    async remove(key) {
      assertStatementKey(key);
      const root = await getStorageRoot(storagePath, false);
      if (!root) return;
      const parentPath = await getObjectParent(root, key, false);
      if (!parentPath) return;
      const objectPath = join(parentPath, key.split('/').at(-1) ?? '');

      try {
        await assertRegularObject(objectPath);
        await unlink(objectPath);
      } catch (error) {
        if (error instanceof Error && error.message === 'Private statement object was not found') return;
        if (error instanceof Error && error.message === 'Symbolic links are not allowed in local document storage') {
          throw error;
        }
        if (isFileSystemError(error, 'ENOENT')) return;
        throw new Error('Local private statement storage operation failed');
      }
    },
  };
}

export function createR2DocumentStorage(clientOverride?: S3Client): PrivateDocumentStorage {
  const environment = getR2Environment();
  const client = clientOverride ?? new S3Client({
    region: 'auto',
    endpoint: environment.R2_ENDPOINT,
    credentials: {
      accessKeyId: environment.R2_ACCESS_KEY_ID,
      secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
    },
  });

  return {
    async put(input) {
      assertStatementKey(input.key);
      assertValidWrite(input.bytes, input.checksumSha256);
      await client.send(new PutObjectCommand({
        Bucket: environment.R2_BUCKET_NAME,
        Key: input.key,
        Body: input.bytes,
        ContentType: input.contentType,
        ChecksumSHA256: Buffer.from(input.checksumSha256, 'hex').toString('base64'),
      }), storageOperationOptions());
    },
    async get(key) {
      assertStatementKey(key);
      const response = await client.send(
        new GetObjectCommand({Bucket: environment.R2_BUCKET_NAME, Key: key}),
        storageOperationOptions(),
      );
      if (!response.Body) throw new Error('Private statement object was not found');
      if (response.ContentLength !== undefined && response.ContentLength > pdfImportLimits.maxBytes) {
        throw new Error('Private statement object exceeds the download limit');
      }
      return readBoundedStream(response.Body.transformToWebStream());
    },
    async remove(key) {
      assertStatementKey(key);
      await client.send(
        new DeleteObjectCommand({Bucket: environment.R2_BUCKET_NAME, Key: key}),
        storageOperationOptions(),
      );
    },
  };
}

let documentStorage: PrivateDocumentStorage | undefined;

export function getPrivateDocumentStorage() {
  if (!documentStorage) {
    const environment = getDocumentStorageEnvironment();
    documentStorage = environment.DOCUMENT_STORAGE_DRIVER === 'local'
      ? createLocalDocumentStorage(environment.LOCAL_DOCUMENT_STORAGE_PATH)
      : createR2DocumentStorage();
  }
  return documentStorage;
}
