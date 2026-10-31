import crypto from 'crypto';

/** Constant-time string compare. Returns false if either value is missing or lengths differ. */
export function timingSafeEqualString(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
