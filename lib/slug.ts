import { customAlphabet } from 'nanoid';

const suffixGen = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 4);

export function makeSlug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 24);
  const namePart = cleaned || 'user';
  return `${namePart}-${suffixGen()}`;
}
