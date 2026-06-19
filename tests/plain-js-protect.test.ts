import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ProtectPipeline } from '../src/pipeline/ProtectPipeline.js';
import { NullOutputWriter } from '../src/utils/output.js';

describe('plain JS project protect', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
        await rm(`${dir}_funimas`, { recursive: true, force: true });
      }),
    );
  });

  it('protege un proyecto JS sin tsconfig ni package.json', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-plain-js-protect-'));
    tempDirs.push(projectDir);

    await writeFile(
      join(projectDir, 'document-review.js'),
      "import { addDoc, collection } from 'firebase/firestore';\nimport { db } from './firebase.js';\n\nexport async function createReview(data) {\n  return addDoc(collection(db, 'reviews'), data);\n}\n",
      'utf8',
    );
    await writeFile(
      join(projectDir, 'firebase.js'),
      "import { initializeApp } from 'firebase/app';\nimport { getAuth } from 'firebase/auth';\nimport { getFirestore } from 'firebase/firestore';\n\nconst app = initializeApp({ projectId: 'demo' });\nexport const auth = getAuth(app);\nexport const db = getFirestore(app);\n",
      'utf8',
    );
    await writeFile(
      join(projectDir, 'netlify.toml'),
      '[build]\n  functions = "netlify/functions"\n',
      'utf8',
    );

    const pipeline = new ProtectPipeline({
      projectPath: projectDir,
      output: new NullOutputWriter(),
    });

    const result = await pipeline.execute();

    expect(result.success).toBe(true);
    expect(result.validationResult.valid).toBe(true);
    expect(result.semanticResult.totalOperations).toBeGreaterThan(0);
    expect(result.transformationsRegistered).toBeGreaterThan(0);

    const workspacePath = result.workspaceResult.workspaceProject;
    const rewritten = await readFile(join(workspacePath, 'document-review.js'), 'utf8');
    const firebaseConfig = await readFile(join(workspacePath, 'firebase.js'), 'utf8');

    expect(rewritten).toContain('Funimas.database.insert');
    expect(rewritten).toContain('from "./sdk/index.js"');
    expect(firebaseConfig).toContain('configureFunimas');
    expect(firebaseConfig).toContain('from "./sdk/index.js"');
    expect(firebaseConfig).toContain(
      'getIdToken: async () => auth.currentUser?.getIdToken() ?? null',
    );

    await expect(stat(join(workspacePath, 'tsconfig.json'))).resolves.toBeDefined();
    await expect(stat(join(workspacePath, 'types/netlify.d.ts'))).resolves.toBeDefined();
    await expect(stat(join(workspacePath, 'package.json'))).resolves.toBeDefined();
    await expect(stat(join(workspacePath, 'netlify/functions/database_insert.ts'))).resolves.toBeDefined();
    await expect(stat(join(workspacePath, 'sdk/index.ts'))).resolves.toBeDefined();
    await expect(stat(join(workspacePath, 'sdk/index.js'))).resolves.toBeDefined();
    await expect(stat(join(workspacePath, 'runtime/handler.ts'))).resolves.toBeDefined();
  });
});
