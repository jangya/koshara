const requiredNames = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'ALLOWED_USER_EMAILS',
  'DATABASE_URL',
  'DOCUMENT_STORAGE_DRIVER',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GMAIL_TOKEN_ENCRYPTION_KEY',
];

const documentStorageDriver = process.env.DOCUMENT_STORAGE_DRIVER?.trim();
if (documentStorageDriver === 'r2') {
  requiredNames.push(
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_ENDPOINT',
  );
} else if (documentStorageDriver === 'local') {
  if (process.env.NODE_ENV === 'production') {
    console.error('Koshara cannot start: local document storage is allowed only in development or test');
    process.exitCode = 1;
  }
} else if (documentStorageDriver) {
  console.error('Koshara cannot start: DOCUMENT_STORAGE_DRIVER must be local or r2');
  process.exitCode = 1;
}

const missingNames = requiredNames.filter((name) => !process.env[name]?.trim());

if (missingNames.length > 0) {
  console.error(`Koshara cannot start: missing ${missingNames.join(', ')}`);
  process.exitCode = 1;
}
