import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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
import { DatabaseInsertRewriteRule } from '../src/rewriter/rules/DatabaseInsertRewriteRule.js';
import { NullOutputWriter } from '../src/utils/output.js';


import { ProtectCommand } from '../src/cli/commands/protect-command.js';

const examplesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');
const reactFirebaseCrudPath = join(examplesDir, 'react-firebase-crud');

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

function countCalleeUsages(sourceFilePath: string, calleeName: string): number {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(sourceFilePath);

  return sourceFile
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((identifier) => {
      if (identifier.getText() !== calleeName) {
        return false;
      }

      const parent = identifier.getParent();

      return parent?.getKind() === SyntaxKind.CallExpression && parent.getChildAtIndex(0) === identifier;
    }).length;
}

function countFunimasInsertCalls(sourceFilePath: string): number {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(sourceFilePath);

  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    return callExpression.getExpression().getText() === 'Funimas.database.insert';
  }).length;
}

describe('DatabaseInsertRewriteRule', () => {
  it('transforma addDoc en Funimas.database.insert mediante ts-morph', async () => {
    const tempProjectPath = await mkdtemp(join(tmpdir(), 'funimas-rewrite-'));
    await cp(reactFirebaseCrudPath, tempProjectPath, { recursive: true });

    try {
      const semanticResult = await analyzeProject(tempProjectPath);
      const insertOperation = semanticResult
        .getOperationsByType('DATABASE_INSERT')
        .find((operation) => operation.metadata.callee === 'addDoc');

      expect(insertOperation).toBeDefined();

      const rewriter = new CodeRewriter();
      const rewriteResult = await rewriter.rewrite(
        new RewriteContext({
          projectPath: tempProjectPath,
          workspacePath: tempProjectPath,
          semanticResult,
        }),
      );

      expect(rewriteResult.totalOperationsRewritten).toBe(6);
      expect(rewriteResult.modifiedFiles).toContain('App.tsx');
      expect(rewriteResult.modifiedFiles).toContain('clientes.ts');
      expect(rewriteResult.modifiedFiles).toContain('firebase.ts');
      expect(rewriteResult.operationsRewritten.DATABASE_INSERT).toBe(6);
      expect(rewriteResult.importsAdded.length).toBeGreaterThan(0);

      const appPath = join(tempProjectPath, 'src/App.tsx');
      const clientesPath = join(tempProjectPath, 'src/clientes.ts');
      const firebasePath = join(tempProjectPath, 'src/firebase.ts');

      expect(countCalleeUsages(appPath, 'addDoc')).toBe(0);
      expect(countCalleeUsages(clientesPath, 'addDoc')).toBe(0);
      expect(countCalleeUsages(firebasePath, 'addDoc')).toBe(0);
      expect(countFunimasInsertCalls(appPath)).toBe(2);
      expect(countFunimasInsertCalls(clientesPath)).toBe(3);
      expect(countFunimasInsertCalls(firebasePath)).toBe(1);
    } finally {
      await rm(tempProjectPath, { recursive: true, force: true });
    }
  });

  it('solo aplica a operaciones DATABASE_INSERT con callee addDoc', () => {
    const rule = new DatabaseInsertRewriteRule();

    expect(
      rule.canApply({
        type: 'DATABASE_INSERT',
        metadata: { callee: 'addDoc' },
      } as never),
    ).toBe(true);

    expect(
      rule.canApply({
        type: 'DATABASE_INSERT',
        metadata: { callee: 'setDoc' },
      } as never),
    ).toBe(false);

    expect(
      rule.canApply({
        type: 'DATABASE_UPDATE',
        metadata: { callee: 'updateDoc' },
      } as never),
    ).toBe(false);
  });
});

describe('ProtectCommand + CodeRewriter integration', () => {
  it(
    'reescribe el workspace del ejemplo react-firebase-crud sin tocar el original',
    async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-rewrite-integration-'));
    await cp(reactFirebaseCrudPath, projectDir, { recursive: true });

    const originalApp = await readFile(join(projectDir, 'src/App.tsx'), 'utf8');

    const command = new ProtectCommand({
      projectPath: projectDir,
      output: new NullOutputWriter(),
    });

    await command.execute();

    const workspacePath = `${projectDir}_funimas`;

    try {
      const workspaceApp = await readFile(join(workspacePath, 'src/App.tsx'), 'utf8');
      const untouchedApp = await readFile(join(projectDir, 'src/App.tsx'), 'utf8');

      expect(workspaceApp).toContain('Funimas.database.insert');
      expect(workspaceApp).not.toContain('addDoc(');
      expect(untouchedApp).toBe(originalApp);

      const historyDir = join(workspacePath, '.funimas/history');
      const historyFiles = (await readdir(historyDir)).filter((file) => file.endsWith('.json'));
      const historyContents = await Promise.all(
        historyFiles.map((file) => readFile(join(historyDir, file), 'utf8')),
      );
      const changesMarkdown = await readFile(
        join(workspacePath, '.funimas/reports/changes.md'),
        'utf8',
      );
      const summaryJson = JSON.parse(
        await readFile(join(workspacePath, '.funimas/reports/summary.json'), 'utf8'),
      ) as Record<string, unknown>;

      expect(historyContents.some((content) => content.includes('DatabaseInsertRewriteRule'))).toBe(
        true,
      );
      expect(historyContents.some((content) => content.includes('addDoc'))).toBe(true);
      expect(historyContents.some((content) => content.includes('"reason"'))).toBe(true);
      expect(historyContents.some((content) => content.includes('"riskLevel"'))).toBe(true);
      expect(historyFiles.length).toBeGreaterThanOrEqual(7);
      expect(changesMarkdown).toContain('Funimas.database.insert');
      expect(changesMarkdown).toContain('**Motivo:**');
      expect(changesMarkdown).toContain('## Resumen');
      expect(changesMarkdown).toContain('## Archivos generados por Funimas');
      expect(changesMarkdown).toContain('Menor exposición del backend');
      expect(summaryJson.generatedFiles).toEqual(
        expect.arrayContaining(['runtime/handler.ts', 'netlify/functions/database_insert.ts']),
      );

      const validationMarkdown = await readFile(
        join(workspacePath, '.funimas/reports/validation.md'),
        'utf8',
      );
      const validationJson = JSON.parse(
        await readFile(join(workspacePath, '.funimas/reports/validation.json'), 'utf8'),
      ) as Record<string, unknown>;

      expect(validationMarkdown).toContain('Validation Report');
      expect(validationJson.valid).toBe(true);
    } finally {
      await rm(workspacePath, { recursive: true, force: true });
      await rm(join(projectDir, '.funimas'), { recursive: true, force: true });
      await rm(projectDir, { recursive: true, force: true });
    }
  },
    15000,
  );
});
