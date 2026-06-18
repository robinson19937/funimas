import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { NetlifyAdapter } from '../src/adapters/netlify/NetlifyAdapter.js';
import { WorkspaceConfigGenerator } from '../src/generator/WorkspaceConfigGenerator.js';
import { GeneratorContext } from '../src/generator/GeneratorContext.js';
import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';
import { GraphBuilder } from '../src/graph/GraphBuilder.js';
import { SemanticAnalyzer } from '../src/semantic/SemanticAnalyzer.js';
import { CodeRewriter } from '../src/rewriter/CodeRewriter.js';
import { RewriteContext } from '../src/rewriter/RewriteContext.js';

describe('rewrite plain JS after workspace config', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
        await rm(`${dir}_funimas`, { recursive: true, force: true });
      }),
    );
  });

  it('reescribe addDoc tras generar tsconfig en el workspace', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-rewrite-js-'));
    tempDirs.push(projectDir);
    const workspacePath = `${projectDir}_funimas`;

    await writeFile(
      join(projectDir, 'document-review.js'),
      "import { addDoc, collection } from 'firebase/firestore';\nimport { db } from './firebase.js';\n\nexport async function createReview(data) {\n  return addDoc(collection(db, 'reviews'), data);\n}\n",
      'utf8',
    );
    await writeFile(join(projectDir, 'firebase.js'), "export const db = {};\n", 'utf8');
    await writeFile(join(projectDir, 'netlify.toml'), '[build]\n  functions = "netlify/functions"\n', 'utf8');

    const { cp } = await import('node:fs/promises');
    await cp(projectDir, workspacePath, { recursive: true });

    const parseResult = await new AstParser().parse(workspacePath);
    const scanResult = await new ProjectScanner().scan(parseResult.project);
    const graphResult = new GraphBuilder().build(scanResult);
    const semanticResult = await new SemanticAnalyzer().analyze(graphResult);

    const generatorContext = new GeneratorContext({
      projectPath: projectDir,
      workspacePath,
      semanticResult,
      adapter: new NetlifyAdapter(),
    });

    await new WorkspaceConfigGenerator().generate(generatorContext);

    const rewriter = new CodeRewriter();
    const rewriteResult = await rewriter.rewrite(
      new RewriteContext({
        projectPath: projectDir,
        workspacePath,
        semanticResult,
      }),
    );

    const rewritten = await readFile(join(workspacePath, 'document-review.js'), 'utf8');

    expect(rewriteResult.modifiedFiles).toContain('document-review.js');
    expect(rewritten).toContain('Funimas.database.insert');
  });
});
