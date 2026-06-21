import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  isValidFirebasePrivateKey,
  normalizeFirebasePrivateKey,
} from '../src/utils/firebase-private-key.js';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

describe('normalizeFirebasePrivateKey', () => {
  it('convierte \\n escapados a saltos de línea reales', () => {
    const escaped = privateKey.replace(/\n/g, '\\n');
    const normalized = normalizeFirebasePrivateKey(escaped);

    expect(normalized).toContain('-----BEGIN PRIVATE KEY-----\n');
    expect(normalized).toContain('\n-----END PRIVATE KEY-----');
  });

  it('elimina comillas envolventes de .env', () => {
    const quoted = `"${privateKey.replace(/\n/g, '\\n')}"`;
    const normalized = normalizeFirebasePrivateKey(quoted);

    expect(normalized?.startsWith('-----BEGIN PRIVATE KEY-----\n')).toBe(true);
  });

  it('valida claves PEM parseables', () => {
    expect(isValidFirebasePrivateKey(privateKey)).toBe(true);
    expect(isValidFirebasePrivateKey('not-a-key')).toBe(false);
  });
});
