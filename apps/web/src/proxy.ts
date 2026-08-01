import {clerkMiddleware} from '@clerk/nextjs/server';

// Next.js Proxy establishes Clerk request context. Every protected page and
// Server Action still performs its own authorization check.
export default clerkMiddleware({
  // Clerk maintains the auth-specific source list and adjusts Next.js
  // development directives without exposing server credentials to the client.
  contentSecurityPolicy: {},
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
