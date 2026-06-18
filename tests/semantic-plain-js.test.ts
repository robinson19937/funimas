import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';
import { GraphBuilder } from '../src/graph/GraphBuilder.js';
import { SemanticAnalyzer } from '../src/semantic/SemanticAnalyzer.js';

describe('semantic analyzer plain JS', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('detecta addDoc en archivos JavaScript sin tsconfig', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-semantic-js-'));
    tempDirs.push(projectDir);

    await writeFile(
      join(projectDir, 'document-review.js'),
      "import { addDoc, collection } from 'firebase/firestore';\nimport { db } from './firebase.js';\n\nexport async function createReview(data) {\n  return addDoc(collection(db, 'reviews'), data);\n}\n",
      'utf8',
    );
    await writeFile(join(projectDir, 'firebase.js'), "export const db = {};\n", 'utf8');

    const parseResult = await new AstParser().parse(projectDir);
    const scanResult = await new ProjectScanner().scan(parseResult.project);
    const graphResult = new GraphBuilder().build(scanResult);
    const semanticResult = await new SemanticAnalyzer().analyze(graphResult);

    expect(
      semanticResult.operations.some(
        (operation) => operation.type === 'DATABASE_INSERT' && operation.metadata.callee === 'addDoc',
      ),
    ).toBe(true);
  });
});
