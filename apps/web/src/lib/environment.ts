import {parseAllowedEmails} from '@koshara/domain';
import {z} from 'zod';

const serverEnvironmentSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  ALLOWED_USER_EMAILS: z.string().min(1),
  DATABASE_URL: z.string().min(1),
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
