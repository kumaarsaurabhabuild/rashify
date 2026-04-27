import { createHash } from 'node:crypto';
export function ipHash(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? '';
  return createHash('sha256').update(ip + salt).digest('hex');
}
