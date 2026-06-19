import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DeployConfigGenerator } from '../src/generator/DeployConfigGenerator.js';
import { GeneratorContext } from '../src/generator/GeneratorContext.js';
import { NetlifyAdapter } from '../src/adapters/netlify/NetlifyAdapter.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';

describe('DeployConfigGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('genera firebase.json, firestore.rules, .env.example y parchea netlify.toml', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-deploy-config-'));
    tempDirs.push(workspacePath);

    await writeFile(
      join(workspacePath, 'netlify.toml'),
      '[build]\n  publish = "dist"\n',
      'utf8',
    );
    await writeFile(
      join(workspacePath, 'storage.rules'),
      'rules_version = "2";\nservice firebase.storage { match /b/{bucket}/o { match /{allPaths=**} { allow read, write: if false; } } }\n',
      'utf8',
    );

    const generator = new DeployConfigGenerator();
    const context = new GeneratorContext({
      projectPath: workspacePath,
      workspacePath,
      semanticResult: new SemanticResult({ operations: [], providers: ['firebase'] }),
      adapter: new NetlifyAdapter(),
    });

    const result = await generator.generate(context, new NetlifyAdapter());

    expect(result.filesWritten).toContain('netlify.toml');
    expect(result.filesWritten).toContain('firestore.rules');
    expect(result.filesWritten).toContain('firebase.json');
    expect(result.filesWritten).toContain('.env.example');
    expect(result.filesWritten).toContain('funimas.config.json');
    expect(result.netlifyTomlPatched).toBe(true);

    const netlifyToml = await readFile(join(workspacePath, 'netlify.toml'), 'utf8');
    expect(netlifyToml).toContain('/api/*');

    const firebaseJson = JSON.parse(await readFile(join(workspacePath, 'firebase.json'), 'utf8'));
    expect(firebaseJson.firestore.rules).toBe('firestore.rules');
    expect(firebaseJson.storage.rules).toBe('storage.rules');

    const funimasConfig = JSON.parse(
      await readFile(join(workspacePath, 'funimas.config.json'), 'utf8'),
    );
    expect(funimasConfig.allowedCollections).toEqual(['clubs']);
  });
});
