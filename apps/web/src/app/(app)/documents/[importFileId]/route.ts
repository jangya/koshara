import {createHash} from 'node:crypto';

import {getStatementDocument} from '@koshara/database';
import {z} from 'zod';

import {requireHouseholdAccess} from '@/lib/auth';
import {getDatabase} from '@/lib/database';
import {getPrivateDocumentStorage} from '@/lib/private-document-storage';

function encodedFilename(filename: string) {
  return encodeURIComponent(filename).replaceAll("'", '%27').replaceAll('*', '%2A');
}

export async function GET(_request: Request, {params}: {params: Promise<{importFileId: string}>}) {
  try {
    const context = await requireHouseholdAccess();
    const parsedId = z.uuid().safeParse((await params).importFileId);
    if (!parsedId.success) return new Response(null, {status: 404});
    const document = await getStatementDocument(getDatabase(), context.householdId, parsedId.data);
    if (!document) return new Response(null, {status: 404});

    const bytes = await getPrivateDocumentStorage().get(document.objectKey);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== document.byteSize || checksum !== document.checksumSha256) {
      return new Response('The private statement failed its integrity check', {status: 409});
    }

    return new Response(Buffer.from(bytes), {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': `attachment; filename="statement.pdf"; filename*=UTF-8''${encodedFilename(document.originalFilename)}`,
        'Content-Length': String(bytes.length),
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, {status: 404});
  }
}
