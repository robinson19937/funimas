import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { TransformationHistory } from '../src/history/TransformationHistory.js';
import { HistoryReader } from '../src/history/HistoryWriter.js';
import { TransformationRecord } from '../src/history/TransformationRecord.js';
import { ChangeReportGenerator } from '../src/report/ChangeReportGenerator.js';
import { RuntimeGenerator } from '../src/runtime/RuntimeGenerator.js';
import { RuntimeContext } from '../src/runtime/RuntimeContext.js';
import { RUNTIME_FILE_DEFINITIONS } from '../src/runtime/RuntimeGenerator.js';
import { RuntimeTemplateEngine } from '../src/runtime/RuntimeTemplateEngine.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';

describe('RuntimeGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('genera todos los archivos del runtime con plantillas Handlebars', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-backend-runtime-'));
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);
    const generator = new RuntimeGenerator();

    const result = await generator.generate(
      new RuntimeContext({
        projectPath: '/tmp/original',
        workspacePath,
        history,
      }),
    );

    expect(result.generatedFiles).toHaveLength(RUNTIME_FILE_DEFINITIONS.length);
    expect(result.generatedFiles.map((file) => file.fileName)).toEqual([
      'handler.ts',
      'router.ts',
      'databaseController.ts',
      'firestoreRepository.ts',
      'Request.ts',
      'Response.ts',
    ]);

    const handler = await readFile(join(workspacePath, 'runtime/handler.ts'), 'utf8');
    const repository = await readFile(
      join(workspacePath, 'runtime/repositories/firestoreRepository.ts'),
      'utf8',
    );

    expect(handler).toContain('createHandler');
    expect(repository).toContain('class FirestoreRepository');
    expect(history.getRecordCount()).toBe(RUNTIME_FILE_DEFINITIONS.length);
  });
});

describe('TransformationHistory', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('guarda registros secuenciales sin sobrescribir historial previo', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-history-'));
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);

    await history.record({
      file: join(workspacePath, 'src/App.tsx'),
      operation: 'DATABASE_INSERT',
      rewriteRule: 'DatabaseInsertRewriteRule',
      before: 'addDoc(...)',
      after: 'Funimas.database.insert(...)',
      generatedFiles: [],
      modifiedImports: ['@funimas/sdk:Funimas'],
      status: 'COMPLETED',
    });

    await history.record({
      file: join(workspacePath, 'src/clientes.ts'),
      operation: 'DATABASE_INSERT',
      rewriteRule: 'DatabaseInsertRewriteRule',
      before: 'addDoc(...)',
      after: 'Funimas.database.insert(...)',
      generatedFiles: [],
      modifiedImports: [],
      status: 'COMPLETED',
    });

    const reader = new HistoryReader();
    const records = await reader.readAll(workspacePath);

    expect(records).toHaveLength(2);
    expect(records[0]?.rewriteRule).toBe('DatabaseInsertRewriteRule');
    expect(records[1]?.operation).toBe('DATABASE_INSERT');

    const firstRecord = await readFile(join(workspacePath, '.funimas/history/000001.json'), 'utf8');
    const secondRecord = await readFile(join(workspacePath, '.funimas/history/000002.json'), 'utf8');

    expect(firstRecord).toContain('DatabaseInsertRewriteRule');
    expect(secondRecord).toContain('clientes.ts');
  });
});

describe('ChangeReportGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('genera changes.md, changes.html y summary.json', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-report-'));
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);

    await history.record({
      file: join(workspacePath, 'src/App.tsx'),
      operation: 'DATABASE_INSERT',
      rewriteRule: 'DatabaseInsertRewriteRule',
      before: 'await addDoc(collection(db,"clientes"),cliente);',
      after: 'await Funimas.database.insert("clientes",cliente);',
      generatedFiles: [],
      modifiedImports: ['@funimas/sdk:Funimas'],
      status: 'COMPLETED',
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

    const generator = new ChangeReportGenerator();
    const result = await generator.generate(workspacePath, history, semanticResult, 1200, new Date());

    const markdown = await readFile(result.markdownPath, 'utf8');
    const html = await readFile(result.htmlPath, 'utf8');
    const summary = JSON.parse(await readFile(result.summaryPath, 'utf8')) as Record<string, unknown>;

    expect(markdown).toContain('DatabaseInsertRewriteRule');
    expect(markdown).toContain('await addDoc(collection(db,"clientes"),cliente);');
    expect(markdown).toContain('await Funimas.database.insert("clientes",cliente);');
    expect(markdown).toContain('### Motivo');
    expect(markdown).toContain('### Beneficio');
    expect(html).toContain('<html');
    expect(html).toContain('DATABASE_INSERT');
    expect(summary.modifiedFiles).toEqual(['src/App.tsx']);
    expect(summary.operationsFound).toMatchObject({ DATABASE_INSERT: 6 });
    expect(summary.operationsTransformed).toMatchObject({ DATABASE_INSERT: 1 });
    expect(summary.funimasVersion).toBe('0.1.0');
    expect(summary.totalReasons).toBe(0);
    expect(summary.totalBenefits).toBe(0);
    expect(summary.compilerVersion).toBe('0.1.0');
    expect(summary.executionId).toBeDefined();
  });
});

describe('HistoryReader', () => {
  it('devuelve lista vacía cuando no existe historial', async () => {
    const reader = new HistoryReader();
    const records = await reader.readAll('/tmp/missing-workspace');

    expect(records).toEqual([]);
    expect(await reader.getNextSequence('/tmp/missing-workspace')).toBe(1);
  });
});

describe('TransformationRecord', () => {
  it('reconstruye registros desde JSON con valores por defecto', () => {
    const record = TransformationRecord.fromJSON({
      id: 'record-1',
      timestamp: '2026-06-18T17:00:00.000Z',
      file: 'src/App.tsx',
      operation: 'DATABASE_INSERT',
      rewriteRule: 'DatabaseInsertRewriteRule',
    });

    expect(record.before).toBe('');
    expect(record.after).toBe('');
    expect(record.generatedFiles).toEqual([]);
    expect(record.modifiedImports).toEqual([]);
    expect(record.status).toBe('COMPLETED');
    expect(record.validationStatus).toBe('PENDING');
    expect(record.rollbackExecuted).toBe(false);
  });
});

describe('RuntimeTemplateEngine', () => {
  it('reutiliza plantillas compiladas en memoria', async () => {
    const engine = new RuntimeTemplateEngine();
    const first = await engine.render('runtime/handler.hbs');
    const second = await engine.render('runtime/handler.hbs');

    expect(first).toBe(second);
  });
});

describe('RuntimeGenerator safety', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('rechaza rutas que escapan del workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-runtime-safe-'));
    tempDirs.push(workspacePath);
    const generator = new RuntimeGenerator({
      fileDefinitions: [
        {
          templatePath: 'runtime/handler.hbs',
          outputPath: '../escape/handler.ts',
        },
      ],
    });

    await expect(
      generator.generate(
        new RuntimeContext({
          projectPath: '/tmp/original',
          workspacePath,
        }),
      ),
    ).rejects.toThrow('No se puede escribir fuera del workspace');
  });
});

describe('ChangeReportGenerator paths', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('usa basename para rutas fuera del workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-report-paths-'));
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);

    await history.record({
      file: '/external/path/App.tsx',
      operation: 'DATABASE_INSERT',
      rewriteRule: 'DatabaseInsertRewriteRule',
      before: 'before',
      after: 'after',
      generatedFiles: [],
      modifiedImports: [],
      status: 'COMPLETED',
    });

    const semanticResult = new SemanticResult({
      operations: [],
      totalOperations: 0,
      operationsByType: createEmptyActionsByType(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    const generator = new ChangeReportGenerator();
    const result = await generator.generate(workspacePath, history, semanticResult, 100, new Date());

    expect(result.summary.modifiedFiles).toEqual(['App.tsx']);
  });
});
