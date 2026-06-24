import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Project, SyntaxKind } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { GraphBuilder } from '../src/graph/GraphBuilder.js';
import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';
import { SemanticAnalyzer } from '../src/semantic/SemanticAnalyzer.js';
import { CodeRewriter } from '../src/rewriter/CodeRewriter.js';
import { RewriteContext } from '../src/rewriter/RewriteContext.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const firestoreFixturePath = join(fixturesDir, 'firebase-project');

async function analyzeProject(projectPath: string) {
  const parser = new AstParser();
  const scanner = new ProjectScanner();
  const graphBuilder = new GraphBuilder();
  const semanticAnalyzer = new SemanticAnalyzer();

  const parseResult = await parser.parse(projectPath);
  const scanResult = await scanner.scan(parseResult.project);
  const graphResult = graphBuilder.build(scanResult);

  return semanticAnalyzer.analyze(graphResult);
}

function countFunimasCalls(sourceFilePath: string, method: string): number {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(sourceFilePath);

  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    return callExpression.getExpression().getText() === `Funimas.database.${method}`;
  }).length;
}

describe('Firestore CRUD rewrite rules', () => {
  it('transforma getDoc, setDoc, updateDoc, deleteDoc y getDocs', async () => {
    const tempProjectPath = await mkdtemp(join(tmpdir(), 'funimas-crud-rewrite-'));
    await cp(firestoreFixturePath, tempProjectPath, { recursive: true });

    try {
      const semanticResult = await analyzeProject(tempProjectPath);
      const rewriter = new CodeRewriter();
      const rewriteResult = await rewriter.rewrite(
        new RewriteContext({
          projectPath: tempProjectPath,
          workspacePath: tempProjectPath,
          semanticResult,
        }),
      );

      expect(rewriteResult.operationsRewritten.DATABASE_READ).toBe(2);
      expect(rewriteResult.operationsRewritten.DATABASE_INSERT).toBe(2);
      expect(rewriteResult.operationsRewritten.DATABASE_UPDATE).toBe(1);
      expect(rewriteResult.operationsRewritten.DATABASE_DELETE).toBe(1);

      const servicePath = join(
        tempProjectPath,
        'src/services/firestore-service.ts',
      );
      const content = await readFile(servicePath, 'utf8');
      const firebaseContent = await readFile(join(tempProjectPath, 'src/firebase.ts'), 'utf8');

      expect(content).toContain('Funimas.database.insert');
      expect(content).toContain('Funimas.database.set');
      expect(content).toContain('Funimas.database.update');
      expect(content).toContain('Funimas.database.delete');
      expect(content).toContain('Funimas.database.get');
      expect(content).toContain('Funimas.database.list');
      expect(firebaseContent).toContain('configureFunimas');
      expect(firebaseContent).toContain('from "../sdk/index.js"');
      expect(firebaseContent).toContain(
        'getIdToken: async () => auth?.currentUser?.getIdToken() ?? null',
      );
      expect(countFunimasCalls(servicePath, 'get')).toBe(1);
      expect(countFunimasCalls(servicePath, 'list')).toBe(1);
    } finally {
      await rm(tempProjectPath, { recursive: true, force: true });
    }
  });
});
