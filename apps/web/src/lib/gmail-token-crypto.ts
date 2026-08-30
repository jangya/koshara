import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';

export type GmailTokenContext = {
  householdId: string;
  connectionId: string;
  tokenKind: 'access' | 'refresh' | 'oauth-code-verifier';
};

const algorithm = 'aes-256-gcm';
const nonceBytes = 12;
const tagBytes = 16;

function assertKey(key: Uint8Array) {
  if (key.byteLength !== 32) throw new Error('The Gmail token encryption key is invalid');
}

function additionalAuthenticatedData(context: GmailTokenContext) {
  return Buffer.from([
    'koshara-gmail-token-v1',
    context.householdId,
    context.connectionId,
    context.tokenKind,
  ].join('\0'), 'utf8');
}

function decodeCanonicalBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error('invalid envelope');
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) throw new Error('invalid envelope');
  return decoded;
}

export function encryptGmailToken(token: string, key: Uint8Array, context: GmailTokenContext) {
  assertKey(key);
  if (token.length < 1 || token.length > 8_192) throw new Error('The Gmail credential is invalid');
  const nonce = randomBytes(nonceBytes);
  const cipher = createCipheriv(algorithm, key, nonce, {authTagLength: tagBytes});
  cipher.setAAD(additionalAuthenticatedData(context));
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', nonce.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

export function decryptGmailToken(envelope: string, key: Uint8Array, context: GmailTokenContext) {
  try {
    assertKey(key);
    const [version, encodedNonce, encodedCiphertext, encodedTag, ...extra] = envelope.split('.');
    if (version !== 'v1' || !encodedNonce || !encodedCiphertext || !encodedTag || extra.length > 0) {
      throw new Error('invalid envelope');
    }
    const nonce = decodeCanonicalBase64Url(encodedNonce);
    const ciphertext = decodeCanonicalBase64Url(encodedCiphertext);
    const tag = decodeCanonicalBase64Url(encodedTag);
    if (nonce.byteLength !== nonceBytes || tag.byteLength !== tagBytes || ciphertext.byteLength < 1 || ciphertext.byteLength > 8_192) {
      throw new Error('invalid envelope');
    }
    const decipher = createDecipheriv(algorithm, key, nonce, {authTagLength: tagBytes});
    decipher.setAAD(additionalAuthenticatedData(context));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    if (plaintext.length < 1 || plaintext.length > 8_192) throw new Error('invalid envelope');
    return plaintext;
  } catch {
    throw new Error('The Gmail credential could not be decrypted');
  }
}
