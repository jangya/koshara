const requiredNames = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'ALLOWED_USER_EMAILS',
  'DATABASE_URL',
];

const missingNames = requiredNames.filter((name) => !process.env[name]?.trim());

if (missingNames.length > 0) {
  console.error(`Koshara cannot start: missing ${missingNames.join(', ')}`);
  process.exitCode = 1;
}
