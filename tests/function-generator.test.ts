import { cp, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { ProtectCommand } from '../src/cli/commands/protect-command.js';
import { NullOutputWriter } from '../src/utils/output.js';

import { AdapterContext } from '../src/adapters/AdapterContext.js';
import { NetlifyAdapter } from '../src/adapters/netlify/NetlifyAdapter.js';
import {
  FunctionGenerator,
  GeneratorContext,
  GeneratorFileWriter,
  GeneratorFileWriterError,
  ProjectCodeGenerator,
  RuntimeGenerator,
  SDKGenerator,
} from '../src/generator/index.js';
import { SemanticOperation } from '../src/semantic/SemanticOperation.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';

function createSemanticResult(operations: SemanticOperation[]): SemanticResult {
  const operationsByType = createEmptyActionsByType();

  for (const operation of operations) {
    operationsByType[operation.type] += 1;
  }

  return new SemanticResult({
    operations,
    totalOperations: operations.length,
    operationsByType,
    startedAt: new Date('2026-06-18T14:00:00.000Z'),
    finishedAt: new Date('2026-06-18T14:00:01.000Z'),
  });
}

describe('RuntimeGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('genera runtime/index.ts dentro del workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-runtime-'));
    tempDirs.push(workspacePath);
    const generator = new RuntimeGenerator();
    const context = new GeneratorContext({
      projectPath: '/tmp/original',
      workspacePath,
      semanticResult: createSemanticResult([]),
    });

    const result = await generator.generate(context);

    expect(result.runtimeGenerated).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.relativePath).toBe('runtime/index.ts');
    expect(result.files[0]?.fileName).toBe('index.ts');

    const content = await readFile(join(workspacePath, 'runtime/index.ts'), 'utf8');
    expect(content).toContain('funimas-runtime');
    expect(content).toContain('createRuntime');
  });
});

describe('SDKGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('genera sdk/index.ts, sdk/index.js y sdk/database/DatabaseClient.ts', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-sdk-'));
    tempDirs.push(workspacePath);
    const generator = new SDKGenerator();
    const context = new GeneratorContext({
      projectPath: '/tmp/original',
      workspacePath,
      semanticResult: createSemanticResult([]),
    });

    const result = await generator.generate(context);

    expect(result.sdkGenerated).toBe(true);
    expect(result.files.map((file) => file.relativePath)).toEqual([
      'sdk/index.ts',
      'sdk/database/DatabaseClient.ts',
      'sdk/index.js',
    ]);

    const sdkIndex = await readFile(join(workspacePath, 'sdk/index.ts'), 'utf8');
    const browserSdk = await readFile(join(workspacePath, 'sdk/index.js'), 'utf8');
    const databaseClient = await readFile(
      join(workspacePath, 'sdk/database/DatabaseClient.ts'),
      'utf8',
    );

    expect(sdkIndex).toContain("from './database/DatabaseClient.js'");
    expect(sdkIndex).toContain('export const Funimas');
    expect(sdkIndex).toContain('Object.assign(Funimas, configured)');
    expect(browserSdk).toContain('export class DatabaseClient');
    expect(browserSdk).toContain('__funimasFirestoreSentinel');
    expect(browserSdk).toContain('async upsertDocument');
    expect(browserSdk).toContain("'/upsert'");
    expect(databaseClient).toContain('export class DatabaseClient');
    expect(databaseClient).toContain('insert(');
    expect(databaseClient).toContain('updateExistingDocument(');
    expect(databaseClient).toContain('createQuerySnapshot');
  });
});

describe('FunctionGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('genera database_insert.ts delegando en NetlifyAdapter', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-function-'));
    tempDirs.push(workspacePath);
    const generator = new FunctionGenerator();
    const adapter = new NetlifyAdapter();
    const operation = new SemanticOperation({
      type: 'DATABASE_INSERT',
      file: '/tmp/project/src/data.ts',
      line: 10,
      column: 3,
      description: 'addDoc',
      metadata: { provider: 'firebase', category: 'firestore' },
    });
    const context = new GeneratorContext({
      projectPath: '/tmp/original',
      workspacePath,
      semanticResult: createSemanticResult([operation]),
      adapter,
    });

    const result = await generator.generate(context, operation, adapter);

    expect(result.functionFileNames).toEqual(['database_insert.ts']);
    expect(result.files[0]?.relativePath).toBe('netlify/functions/database_insert.ts');

    const content = await readFile(
      join(workspacePath, 'netlify/functions/database_insert.ts'),
      'utf8',
    );

    expect(content).toContain('export const handler');
    expect(content).toContain('statusCode: response.status');
    expect(content).toContain('createHandler');
    expect(content).toContain('/api/insert');
  });
});

describe('NetlifyAdapter.generateFunction', () => {
  it('devuelve archivo, ruta y contenido para DATABASE_INSERT', async () => {
    const adapter = new NetlifyAdapter();
    const operation = new SemanticOperation({
      type: 'DATABASE_INSERT',
      file: '/tmp/project/src/data.ts',
      line: 1,
      column: 1,
      description: 'addDoc',
      metadata: {},
    });
    const context = new AdapterContext({
      projectPath: '/tmp/original',
      workspacePath: '/tmp/original_funimas',
      operation,
    });

    const result = await adapter.generateFunction(context);

    expect(result.data.files).toHaveLength(1);
    expect(result.data.files[0]?.fileName).toBe('database_insert.ts');
    expect(result.data.files[0]?.relativePath).toBe('netlify/functions/database_insert.ts');
    expect(result.data.functions).toEqual(['database_insert.ts']);
    expect(result.data.files[0]?.content).toContain('handler');
  });
});

describe('GeneratorFileWriter', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('rechaza escrituras fuera del workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-writer-'));
    tempDirs.push(workspacePath);
    const writer = new GeneratorFileWriter();

    await expect(
      writer.writeFile(workspacePath, {
        fileName: 'escape.ts',
        relativePath: '../escape.ts',
        content: 'export {}',
      }),
    ).rejects.toBeInstanceOf(GeneratorFileWriterError);
  });

  it('crea directorios intermedios dentro del workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-writer-'));
    tempDirs.push(workspacePath);
    const writer = new GeneratorFileWriter();

    await writer.writeFile(workspacePath, {
      fileName: 'database_insert.ts',
      relativePath: 'netlify/functions/database_insert.ts',
      content: 'export async function handler() {}',
    });

    const content = await readFile(
      join(workspacePath, 'netlify/functions/database_insert.ts'),
      'utf8',
    );

    expect(content).toContain('handler');
  });
});

describe('ProjectCodeGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('genera runtime, sdk y la primera function soportada', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-project-'));
    tempDirs.push(workspacePath);
    await mkdir(join(workspacePath, 'netlify'), { recursive: true });

    const operation = new SemanticOperation({
      type: 'DATABASE_INSERT',
      file: '/tmp/project/src/data.ts',
      line: 1,
      column: 1,
      description: 'addDoc',
      metadata: { provider: 'firebase', category: 'firestore' },
    });
    const context = new GeneratorContext({
      projectPath: '/tmp/original',
      workspacePath,
      semanticResult: createSemanticResult([operation, operation]),
      adapter: new NetlifyAdapter(),
    });
    const generator = new ProjectCodeGenerator();

    const result = await generator.generate(context, new NetlifyAdapter());

    expect(result.runtimeGenerated).toBe(true);
    expect(result.sdkGenerated).toBe(true);
    expect(result.functionFileNames).toEqual(['database_insert.ts']);
    expect(result.totalFiles).toBe(5);
  });
});

describe('ProtectCommand integration', () => {
  const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const firebaseProjectPath = join(fixturesDir, 'firebase-project');
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
        await rm(`${dir}_funimas`, { recursive: true, force: true });
      }),
    );
  });

  it('genera runtime, sdk y function en el workspace sin modificar el original', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-mvp-'));
    tempDirs.push(projectDir);
    await cp(firebaseProjectPath, projectDir, { recursive: true });

    const originalService = await readFile(
      join(projectDir, 'src/services/firestore-service.ts'),
      'utf8',
    );

    const command = new ProtectCommand({
      projectPath: projectDir,
      output: new NullOutputWriter(),
    });

    await command.execute();

    const workspacePath = `${projectDir}_funimas`;
    const runtime = await readFile(join(workspacePath, 'runtime/handler.ts'), 'utf8');
    const sdk = await readFile(join(workspacePath, 'sdk/index.ts'), 'utf8');
    const databaseClient = await readFile(
      join(workspacePath, 'sdk/database/DatabaseClient.ts'),
      'utf8',
    );
    const netlifyFunction = await readFile(
      join(workspacePath, 'netlify/functions/database_insert.ts'),
      'utf8',
    );
    const untouchedService = await readFile(
      join(projectDir, 'src/services/firestore-service.ts'),
      'utf8',
    );

    expect(runtime).toContain('createHandler');
    expect(sdk).toContain('DatabaseClient');
    expect(databaseClient).toContain('class DatabaseClient');
    expect(netlifyFunction).toContain('createHandler');
    expect(netlifyFunction).toContain('runtime.handle');
    expect(netlifyFunction).toContain('/api/insert');
    expect(untouchedService).toBe(originalService);
    await expect(stat(join(projectDir, 'runtime/handler.ts'))).rejects.toThrow();
  });
});
