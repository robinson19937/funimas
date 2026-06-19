import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, afterEach } from 'vitest';

import { GeneratorContext } from '../src/generator/GeneratorContext.js';
import { FirestoreRulesGenerator } from '../src/generator/FirestoreRulesGenerator.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';

describe('FirestoreRulesGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('genera reglas con colecciones detectadas en el código', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-rules-'));
    tempDirs.push(workspacePath);

    await mkdir(join(workspacePath, 'src'), { recursive: true });
    await writeFile(
      join(workspacePath, 'src', 'service.ts'),
      `import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase.js';

export async function createUser() {
  await addDoc(collection(db, 'users'), { name: 'Alice' });
}
`,
      'utf8',
    );

    const semanticResult = new SemanticResult({
      operations: [],
      providers: ['firebase'],
    });

    const generator = new FirestoreRulesGenerator();
    const context = new GeneratorContext({
      projectPath: workspacePath,
      workspacePath,
      semanticResult,
    });

    const result = await generator.generate(context);
    const rules = await readFile(join(workspacePath, 'firestore.rules'), 'utf8');

    expect(result.collections).toContain('users');
    expect(rules).toContain('match /users/{documentId}');
    expect(rules).toContain('allow read, create, update, delete: if false');
  });

  it('preserva reglas existentes con funciones y subcolecciones', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-rules-preserve-'));
    tempDirs.push(workspacePath);

    const existingRules = `service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    match /companies/{companyId} {
      allow read: if isAuthenticated();

      match /settings/{settingId} {
        allow read: if isAuthenticated();
      }
    }
  }
}
`;

    await writeFile(join(workspacePath, 'firestore.rules'), existingRules, 'utf8');

    const generator = new FirestoreRulesGenerator();
    const context = new GeneratorContext({
      projectPath: workspacePath,
      workspacePath,
      semanticResult: new SemanticResult({ operations: [], providers: ['firebase'] }),
    });

    const result = await generator.generate(context);
    const rules = await readFile(join(workspacePath, 'firestore.rules'), 'utf8');

    expect(rules).toContain('function isAuthenticated');
    expect(rules).toContain('match /settings/{settingId}');
    expect(rules).not.toContain('allow read, create, update, delete: if false');
    expect(result.collections).toContain('companies');
  });
});
