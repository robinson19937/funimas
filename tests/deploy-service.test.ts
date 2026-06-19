import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DeployService } from '../src/deploy/index.js';

describe('DeployService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('ejecuta dry-run sin invocar CLIs externos', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-deploy-'));
    tempDirs.push(workspacePath);

    await writeFile(
      join(workspacePath, 'firebase.json'),
      JSON.stringify({ firestore: { rules: 'firestore.rules' } }),
      'utf8',
    );
    await writeFile(join(workspacePath, 'firestore.rules'), "allow read: if false;\n", 'utf8');

    const service = new DeployService();
    const result = await service.deploy({
      workspacePath,
      dryRun: true,
      production: true,
    });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.step).toBe('firestore:rules');
    expect(result.steps[1]?.step).toBe('netlify');
    expect(result.steps[0]?.command).toContain('firebase-tools');
    expect(result.steps[1]?.command).toContain('netlify-cli');
  });

  it('incluye reglas Storage en el deploy Firebase cuando existen', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-deploy-storage-'));
    tempDirs.push(workspacePath);

    await writeFile(
      join(workspacePath, 'firebase.json'),
      JSON.stringify({
        firestore: { rules: 'firestore.rules' },
        storage: { rules: 'storage.rules' },
      }),
      'utf8',
    );
    await writeFile(join(workspacePath, 'firestore.rules'), "allow read: if false;\n", 'utf8');
    await writeFile(join(workspacePath, 'storage.rules'), "allow read, write: if false;\n", 'utf8');

    const service = new DeployService();
    const result = await service.deploy({
      workspacePath,
      dryRun: true,
      production: true,
      skipNetlify: true,
    });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.step).toBe('firebase:rules');
    expect(result.steps[0]?.command).toContain('--only firestore:rules,storage');
  });
});
