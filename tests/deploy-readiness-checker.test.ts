import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DeployReadinessChecker,
  parseEnvFile,
  validateEnvValues,
} from '../src/deploy/deploy-readiness-checker.js';

describe('env validation', () => {
  it('detecta variables de servidor incompletas', () => {
    const values = parseEnvFile('FIREBASE_PROJECT_ID=your-project-id\n');
    const result = validateEnvValues(values);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.variable === 'FIREBASE_CLIENT_EMAIL')).toBe(true);
  });

  it('acepta un .env con credenciales de servidor completas', () => {
    const values = parseEnvFile(`
FIREBASE_PROJECT_ID=my-project
FIREBASE_CLIENT_EMAIL=admin@my-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"
`);

    const result = validateEnvValues(values);

    expect(result.valid).toBe(true);
  });
});

describe('DeployReadinessChecker', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('falla si faltan artefactos obligatorios', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-check-'));
    tempDirs.push(workspacePath);

    const checker = new DeployReadinessChecker();
    const report = await checker.check(workspacePath);

    expect(report.ready).toBe(false);
    expect(report.checks.some((check) => check.name === 'firebase.json' && !check.passed)).toBe(
      true,
    );
  });

  it('pasa cuando el workspace tiene archivos y .env válido', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-check-ok-'));
    tempDirs.push(workspacePath);

    await writeFile(
      join(workspacePath, 'firebase.json'),
      JSON.stringify({ firestore: { rules: 'firestore.rules' } }),
      'utf8',
    );
    await writeFile(join(workspacePath, 'firestore.rules'), 'rules_version = "2";\n', 'utf8');
    await writeFile(
      join(workspacePath, 'funimas.config.json'),
      JSON.stringify({ version: 1, allowedCollections: ['users'] }),
      'utf8',
    );
    await writeFile(
      join(workspacePath, 'netlify.toml'),
      `[build]
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/funimas/:splat"
  status = 200

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["firebase-admin"]
`,
      'utf8',
    );
    await writeFile(
      join(workspacePath, '.env'),
      `FIREBASE_PROJECT_ID=my-project
FIREBASE_CLIENT_EMAIL=admin@my-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"
`,
      'utf8',
    );

    const checker = new DeployReadinessChecker();
    const report = await checker.check(workspacePath);

    expect(report.ready).toBe(true);
  });
});
