import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { NetlifyAdapter } from '../src/adapters/netlify/NetlifyAdapter.js';
import { DatabaseInsertFunctionGenerator } from '../src/generator/functions/DatabaseInsertFunctionGenerator.js';
import { GeneratorContext } from '../src/generator/GeneratorContext.js';
import { TransformationHistory } from '../src/history/TransformationHistory.js';
import { ChangeReportGenerator } from '../src/report/ChangeReportGenerator.js';
import { DATABASE_INSERT_REASON } from '../src/report/TransformationReason.js';
import { DATABASE_INSERT_BENEFITS } from '../src/report/TransformationBenefit.js';
import { SemanticOperation } from '../src/semantic/SemanticOperation.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';
import { RuntimeTemplateEngine } from '../src/runtime/RuntimeTemplateEngine.js';

describe('DatabaseInsertFunctionGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('genera database_insert.ts desde la plantilla Handlebars', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-db-insert-fn-'));
    tempDirs.push(workspacePath);
    const generator = new DatabaseInsertFunctionGenerator();
    const adapter = new NetlifyAdapter();
    const operation = new SemanticOperation({
      type: 'DATABASE_INSERT',
      file: '/tmp/project/src/data.ts',
      line: 10,
      column: 3,
      description: 'addDoc',
      metadata: { provider: 'firebase', category: 'firestore', callee: 'addDoc' },
    });
    const context = new GeneratorContext({
      projectPath: '/tmp/original',
      workspacePath,
      semanticResult: new SemanticResult({
        operations: [operation],
        totalOperations: 1,
        operationsByType: { ...createEmptyActionsByType(), DATABASE_INSERT: 1 },
        startedAt: new Date(),
        finishedAt: new Date(),
      }),
      adapter,
    });

    const result = await generator.generate(context, operation, adapter);

    expect(result).not.toBeNull();
    expect(result!.file.fileName).toBe('database_insert.ts');
    expect(result!.file.relativePath).toBe('netlify/functions/database_insert.ts');

    const content = await readFile(
      join(workspacePath, 'netlify/functions/database_insert.ts'),
      'utf8',
    );

    expect(content).toContain("import type { Handler } from '@netlify/functions'");
    expect(content).toContain('createHandler');
    expect(content).toContain('runtime.handle');
    expect(content).toContain('/api/insert');
    expect(content).not.toContain('Funimas Runtime');
  });

  it('registra metadatos de motivo, beneficio y riesgo', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-db-insert-meta-'));
    tempDirs.push(workspacePath);
    const generator = new DatabaseInsertFunctionGenerator();
    const adapter = new NetlifyAdapter();
    const operation = new SemanticOperation({
      type: 'DATABASE_INSERT',
      file: '/tmp/project/src/data.ts',
      line: 1,
      column: 1,
      description: 'addDoc',
      metadata: { callee: 'addDoc' },
    });
    const context = new GeneratorContext({
      projectPath: '/tmp/original',
      workspacePath,
      semanticResult: new SemanticResult({
        operations: [operation],
        totalOperations: 1,
        operationsByType: { ...createEmptyActionsByType(), DATABASE_INSERT: 1 },
        startedAt: new Date(),
        finishedAt: new Date(),
      }),
      adapter,
    });

    const result = await generator.generate(context, operation, adapter);

    expect(result!.metadata.reason).toBe(DATABASE_INSERT_REASON);
    expect(result!.metadata.benefit).toContain(DATABASE_INSERT_BENEFITS[0]!);
    expect(result!.metadata.riskLevel).toBe('LOW');
    expect(result!.metadata.generatedBy).toBe('DatabaseInsertFunctionGenerator');
    expect(result!.metadata.templateUsed).toBe('templates/netlify/databaseInsert.hbs');
    expect(result!.metadata.relatedGeneratedFiles).toContain('netlify/functions/database_insert.ts');
  });

  it('devuelve null para operaciones no soportadas', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-db-insert-null-'));
    tempDirs.push(workspacePath);
    const generator = new DatabaseInsertFunctionGenerator();
    const adapter = new NetlifyAdapter();
    const operation = new SemanticOperation({
      type: 'DATABASE_UPDATE',
      file: '/tmp/project/src/data.ts',
      line: 1,
      column: 1,
      description: 'updateDoc',
      metadata: {},
    });
    const context = new GeneratorContext({
      projectPath: '/tmp/original',
      workspacePath,
      semanticResult: new SemanticResult({
        operations: [operation],
        totalOperations: 1,
        operationsByType: { ...createEmptyActionsByType(), DATABASE_UPDATE: 1 },
        startedAt: new Date(),
        finishedAt: new Date(),
      }),
      adapter,
    });

    const result = await generator.generate(context, operation, adapter);

    expect(result).toBeNull();
  });
});

describe('Intelligent reports for DATABASE_INSERT', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('genera reportes MD, HTML y JSON con motivos, beneficios y riesgo', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-intelligent-report-'));
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);

    await history.record({
      file: join(workspacePath, 'src/App.tsx'),
      operation: 'DATABASE_INSERT',
      rewriteRule: 'DatabaseInsertRewriteRule',
      before: 'await addDoc(collection(db,"clientes"),cliente);',
      after: 'await Funimas.database.insert("clientes",cliente);',
      generatedFiles: ['netlify/functions/database_insert.ts'],
      modifiedImports: ['@funimas/sdk:Funimas'],
      status: 'COMPLETED',
      reason: DATABASE_INSERT_REASON,
      benefit: DATABASE_INSERT_BENEFITS.join(' '),
      riskLevel: 'LOW',
      generatedBy: 'DatabaseInsertRewriteRule',
      templateUsed: 'templates/netlify/databaseInsert.hbs',
    });

    const semanticResult = new SemanticResult({
      operations: [],
      totalOperations: 0,
      operationsByType: {
        ...createEmptyActionsByType(),
        DATABASE_INSERT: 6,
      },
      startedAt: new Date('2026-06-18T14:00:00.000Z'),
      finishedAt: new Date('2026-06-18T14:00:01.000Z'),
    });

    const executionId = 'test-execution-id';
    const generator = new ChangeReportGenerator();
    const result = await generator.generate(
      workspacePath,
      history,
      semanticResult,
      1200,
      new Date('2026-06-18T14:00:02.000Z'),
      executionId,
    );

    const markdown = await readFile(result.markdownPath, 'utf8');
    const html = await readFile(result.htmlPath, 'utf8');
    const summary = JSON.parse(await readFile(result.summaryPath, 'utf8')) as Record<string, unknown>;

    expect(markdown).toContain('DatabaseInsertRewriteRule');
    expect(markdown).toContain('**Motivo:**');
    expect(markdown).toContain(DATABASE_INSERT_REASON);
    expect(markdown).toContain('**Beneficio:**');
    expect(markdown).toContain('Menor exposición del backend');
    expect(markdown).toContain('## Resumen');

    expect(html).toContain('diff-col before');
    expect(html).toContain('diff-col after');
    expect(html).toContain('Motivo');
    expect(html).toContain('Beneficio');
    expect(html).toContain(DATABASE_INSERT_REASON);

    expect(summary.totalBenefits).toBe(1);
    expect(summary.totalReasons).toBe(1);
    expect(summary.generatedFunctions).toEqual(['netlify/functions/database_insert.ts']);
    expect(summary.compilerVersion).toBe('0.1.0');
    expect(summary.executionId).toBe(executionId);
  });

  it('reutiliza plantillas compiladas para databaseInsert.hbs', async () => {
    const engine = new RuntimeTemplateEngine();
    const first = await engine.render('netlify/databaseInsert.hbs');
    const second = await engine.render('netlify/databaseInsert.hbs');

    expect(first).toBe(second);
    expect(first).toContain('export const handler');
  });
});
