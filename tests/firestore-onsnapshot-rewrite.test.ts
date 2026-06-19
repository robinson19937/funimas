import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GraphBuilder } from '../src/graph/GraphBuilder.js';
import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';
import { SemanticAnalyzer } from '../src/semantic/SemanticAnalyzer.js';
import { CodeRewriter } from '../src/rewriter/CodeRewriter.js';
import { RewriteContext } from '../src/rewriter/RewriteContext.js';

async function analyzeAndRewrite(source: string) {
  const projectPath = await mkdtemp(join(tmpdir(), 'funimas-onsnapshot-'));

  await writeFile(join(projectPath, 'package.json'), '{}', 'utf8');
  await writeFile(join(projectPath, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { module: 'ESNext', target: 'ES2022', moduleResolution: 'Bundler', strict: true },
    include: ['**/*.ts'],
  }), 'utf8');
  await writeFile(join(projectPath, 'app.ts'), source, 'utf8');

  const parser = new AstParser();
  const parseResult = await parser.parse(projectPath);
  const scanResult = await (new ProjectScanner()).scan(parseResult.project);
  const graphResult = (new GraphBuilder()).build(scanResult);
  const semanticResult = await (new SemanticAnalyzer()).analyze(graphResult);
  const rewriter = new CodeRewriter();

  await rewriter.rewrite(
    new RewriteContext({
      projectPath,
      workspacePath: projectPath,
      semanticResult,
    }),
  );

  const content = await readFile(join(projectPath, 'app.ts'), 'utf8');
  await rm(projectPath, { recursive: true, force: true });

  return content;
}

describe('onSnapshot rewrite', () => {
  it('reescribe onSnapshot de documento a Funimas.database.poll', async () => {
    const content = await analyzeAndRewrite(`import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';

export function watchUser(userId: string) {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    console.log(snap.data());
  });
}
`);

    expect(content).toContain("Funimas.database.poll('users', userId,");
    expect(content).not.toContain('onSnapshot(');
  });

  it('reescribe onSnapshot de colección a Funimas.database.pollCollection', async () => {
    const content = await analyzeAndRewrite(`import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';

export function watchUsers() {
  const users = collection(db, 'users');
  return onSnapshot(users, (snapshot) => {
    snapshot.forEach((doc) => console.log(doc.data()));
  });
}
`);

    expect(content).toContain("Funimas.database.pollCollection('users',");
    expect(content).not.toContain('onSnapshot(');
  });
});
