import {parseAllowedEmails} from '@koshara/domain';
import {basename, dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {z} from 'zod';

const serverEnvironmentSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  ALLOWED_USER_EMAILS: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

const r2EnvironmentSchema = z.object({
  R2_ACCOUNT_ID: z.string().regex(/^[0-9a-f]{32}$/u),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u),
  R2_ENDPOINT: z.url(),
}).superRefine((environment, context) => {
  const expectedEndpoint = `https://${environment.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  if (environment.R2_ENDPOINT !== expectedEndpoint) {
    context.addIssue({
      code: 'custom',
      path: ['R2_ENDPOINT'],
      message: 'R2_ENDPOINT must match the configured Cloudflare account endpoint',
    });
  }
});

const documentStorageDriverSchema = z.object({
  DOCUMENT_STORAGE_DRIVER: z.enum(['local', 'r2']),
});

const localDocumentStorageSchema = z.object({
  LOCAL_DOCUMENT_STORAGE_PATH: z.string().trim().min(1).optional(),
});

const gmailEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().regex(/^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$/u),
  GOOGLE_CLIENT_SECRET: z.string().min(16).max(512),
  GOOGLE_OAUTH_REDIRECT_URI: z.url(),
  GMAIL_TOKEN_ENCRYPTION_KEY: z.string().min(1).max(128),
}).superRefine((environment, context) => {
  const applicationUrl = new URL(environment.NEXT_PUBLIC_APP_URL);
  const redirectUrl = new URL(environment.GOOGLE_OAUTH_REDIRECT_URI);
  const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (
    applicationUrl.username
    || applicationUrl.password
    || applicationUrl.search
    || applicationUrl.hash
    || (applicationUrl.pathname !== '/' && applicationUrl.pathname !== '')
    || (applicationUrl.protocol !== 'https:' && !localHostnames.has(applicationUrl.hostname))
  ) {
    context.addIssue({code: 'custom', path: ['NEXT_PUBLIC_APP_URL'], message: 'NEXT_PUBLIC_APP_URL must be a secure origin'});
  }
  if (
    redirectUrl.origin !== applicationUrl.origin
    || redirectUrl.pathname !== '/gmail/oauth/callback'
    || redirectUrl.username
    || redirectUrl.password
    || redirectUrl.search
    || redirectUrl.hash
  ) {
    context.addIssue({
      code: 'custom',
      path: ['GOOGLE_OAUTH_REDIRECT_URI'],
      message: 'GOOGLE_OAUTH_REDIRECT_URI must be the exact application Gmail callback URL',
    });
  }
  const decodedKey = Buffer.from(environment.GMAIL_TOKEN_ENCRYPTION_KEY, 'base64');
  if (decodedKey.byteLength !== 32 || decodedKey.toString('base64') !== environment.GMAIL_TOKEN_ENCRYPTION_KEY) {
    context.addIssue({
      code: 'custom',
      path: ['GMAIL_TOKEN_ENCRYPTION_KEY'],
      message: 'GMAIL_TOKEN_ENCRYPTION_KEY must be exactly 32 random bytes encoded as canonical base64',
    });
  }
});

export function isAuthenticationConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export function getServerEnvironment() {
  const environment = serverEnvironmentSchema.parse(process.env);

  return {
    ...environment,
    allowedEmails: parseAllowedEmails(environment.ALLOWED_USER_EMAILS),
  };
}

export function getR2Environment() {
  return r2EnvironmentSchema.parse(process.env);
}

function getWebApplicationRoot() {
  const workingDirectory = resolve(process.cwd());
  if (basename(workingDirectory) === 'web' && basename(dirname(workingDirectory)) === 'apps') {
    return workingDirectory;
  }
  return resolve(workingDirectory, 'apps/web');
}

function isWithin(parentPath: string, childPath: string) {
  const relativePath = relative(parentPath, childPath);
  return relativePath === ''
    || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
}

export function resolveLocalDocumentStoragePath(configuredPath: string | undefined) {
  const webApplicationRoot = getWebApplicationRoot();
  const repositoryRoot = resolve(webApplicationRoot, '../..');
  const storagePath = resolve(webApplicationRoot, configuredPath ?? '.local/private-documents');
  const allowedRepositoryStorageRoot = resolve(webApplicationRoot, '.local/private-documents');

  if (isWithin(repositoryRoot, storagePath) && !isWithin(allowedRepositoryStorageRoot, storagePath)) {
    throw new Error('Local document storage must remain outside tracked, public, and source directories');
  }

  return storagePath;
}

export function assertLocalDocumentStorageAllowed() {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error('Local document storage is allowed only in development or test');
  }
}

export function getDocumentStorageEnvironment() {
  const {DOCUMENT_STORAGE_DRIVER} = documentStorageDriverSchema.parse(process.env);
  if (DOCUMENT_STORAGE_DRIVER === 'r2') {
    return {DOCUMENT_STORAGE_DRIVER, ...getR2Environment()} as const;
  }

  assertLocalDocumentStorageAllowed();

  const {LOCAL_DOCUMENT_STORAGE_PATH} = localDocumentStorageSchema.parse(process.env);
  return {
    DOCUMENT_STORAGE_DRIVER,
    LOCAL_DOCUMENT_STORAGE_PATH: resolveLocalDocumentStoragePath(LOCAL_DOCUMENT_STORAGE_PATH),
  } as const;
}

export function getGmailEnvironment() {
  const environment = gmailEnvironmentSchema.parse(process.env);
  return {
    NEXT_PUBLIC_APP_URL: environment.NEXT_PUBLIC_APP_URL,
    GOOGLE_CLIENT_ID: environment.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: environment.GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI: environment.GOOGLE_OAUTH_REDIRECT_URI,
    tokenEncryptionKey: new Uint8Array(Buffer.from(environment.GMAIL_TOKEN_ENCRYPTION_KEY, 'base64')),
  };
}
