import { createPrivateKey } from 'node:crypto';

/**
 * Normaliza FIREBASE_PRIVATE_KEY tal como suele llegar desde .env o Netlify.
 */
export function normalizeFirebasePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  let key = raw.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  // Netlify/.env suelen guardar saltos de línea escapados una o dos veces.
  while (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }

  if (key.includes('BEGIN PRIVATE KEY') && !key.includes('\n')) {
    key = key
      .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
      .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
  }

  if (!key.endsWith('\n')) {
    key += '\n';
  }

  return key;
}

export function isValidFirebasePrivateKey(raw: string | undefined): boolean {
  const key = normalizeFirebasePrivateKey(raw);

  if (!key || !key.includes('BEGIN PRIVATE KEY')) {
    return false;
  }

  try {
    createPrivateKey(key);
    return true;
  } catch {
    return false;
  }
}
