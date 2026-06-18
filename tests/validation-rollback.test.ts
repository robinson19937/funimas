import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { TransformationHistory } from '../src/history/TransformationHistory.js';
import { RollbackManager } from '../src/rollback/RollbackManager.js';
import { RollbackContext } from '../src/rollback/RollbackContext.js';
import { ValidationReportGenerator } from '../src/report/ValidationReportGenerator.js';
import { ValidationEngine } from '../src/validation/ValidationEngine.js';
import { ValidationContext } from '../src/validation/ValidationContext.js';
import { ValidationRegistry } from '../src/validation/ValidationRegistry.js';
import { MissingImportsRule } from '../src/validation/rules/MissingImportsRule.js';
import { GeneratedFilesRule } from '../src/validation/rules/GeneratedFilesRule.js';
import { SDKStructureRule } from '../src/validation/rules/SDKStructureRule.js';
import { RuntimeGenerator } from '../src/runtime/RuntimeGenerator.js';
import { RuntimeContext } from '../src/runtime/RuntimeContext.js';
import { SDKGenerator } from '../src/generator/SDKGenerator.js';
import { GeneratorContext } from '../src/generator/GeneratorContext.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';
import { DatabaseInsertFunctionGenerator } from '../src/generator/functions/DatabaseInsertFunctionGenerator.js';
import { NetlifyAdapter } from '../src/adapters/netlify/NetlifyAdapter.js';
import { SemanticOperation } from '../src/semantic/SemanticOperation.js';

async function createValidWorkspace(): Promise<string> {
  const examplesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'react-firebase-crud');
  const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-validation-'));
  await cp(examplesDir, workspacePath, { recursive: true });

  const semanticResult = new SemanticResult({
    operations: [],
    totalOperations: 0,
    operationsByType: createEmptyActionsByType(),
    startedAt: new Date(),
    finishedAt: new Date(),
  });

  const history = new TransformationHistory(workspacePath);
  const generatorContext = new GeneratorContext({
    projectPath: '/tmp/original',
    workspacePath,
    semanticResult,
    adapter: new NetlifyAdapter(),
  });

  const sdkGenerator = new SDKGenerator();
  const sdkResult = await sdkGenerator.generate(generatorContext);

  for (const file of sdkResult.files) {
    await history.record({
      file: file.absolutePath,
      operation: 'GENERATE_SDK',
      rewriteRule: 'SDKGenerator',
      before: '',
      after: file.content,
      generatedFiles: [file.relativePath],
      modifiedImports: [],
      status: 'COMPLETED',
    });
  }

  const runtimeGenerator = new RuntimeGenerator();
  await runtimeGenerator.generate(
    new RuntimeContext({
      projectPath: '/tmp/original',
      workspacePath,
      history,
    }),
  );

  const operation = new SemanticOperation({
    type: 'DATABASE_INSERT',
    file: join(workspacePath, 'src/App.tsx'),
    line: 1,
    column: 1,
    description: 'addDoc',
    metadata: { callee: 'addDoc' },
  });

  const functionGenerator = new DatabaseInsertFunctionGenerator();
  const functionResult = await functionGenerator.generate(
    generatorContext,
    operation,
    new NetlifyAdapter(),
  );

  if (functionResult) {
    await history.record({
      file: functionResult.file.absolutePath,
      operation: 'GENERATE_FUNCTION',
      rewriteRule: 'DatabaseInsertFunctionGenerator',
      before: '',
      after: functionResult.file.content,
      generatedFiles: [functionResult.file.relativePath],
      modifiedImports: [],
      status: 'COMPLETED',
    });
  }

  return workspacePath;
}

async function createWorkspaceWithRewrite(): Promise<string> {
  const workspacePath = await createValidWorkspace();

  const appPath = join(workspacePath, 'src/App.tsx');
  const appContent = await readFile(appPath, 'utf8');
  const before = "addDoc(collection(db, 'users'), { name: 'Ana' })";
  const after = 'Funimas.database.insert("users", { name: "Ana" })';
  const rewritten = appContent
    .replace(
      "import { addDoc, collection } from 'firebase/firestore';",
      "import { collection } from 'firebase/firestore';\nimport { Funimas } from '@funimas/sdk';",
    )
    .replace(before, after);

  await writeFile(appPath, rewritten, 'utf8');

  const history = new TransformationHistory(workspacePath);
  await history.initialize();

  await history.record({
    file: appPath,
    operation: 'DATABASE_INSERT',
    rewriteRule: 'DatabaseInsertRewriteRule',
    before,
    after,
    generatedFiles: ['netlify/functions/database_insert.ts'],
    modifiedImports: ['@funimas/sdk:Funimas'],
    status: 'COMPLETED',
  });

  return workspacePath;
}

describe('ValidationEngine', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('valida compilación correcta del workspace protegido', async () => {
    const workspacePath = await createValidWorkspace();
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);
    await history.initialize();

    const engine = new ValidationEngine();
    const result = await engine.validate(workspacePath, {
      projectPath: '/tmp/original',
      history,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.ruleResults.some((rule) => rule.ruleId === 'typescript-compilation' && rule.passed)).toBe(
      true,
    );
  });

  it('detecta imports faltantes', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-missing-import-'));
    tempDirs.push(workspacePath);
    await mkdir(join(workspacePath, 'src'), { recursive: true });
    await writeFile(
      join(workspacePath, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
        },
        include: ['src/**/*'],
      }),
      'utf8',
    );
    await writeFile(
      join(workspacePath, 'src/broken.ts'),
      "import { missing } from './does-not-exist.js';\nexport const value = missing;\n",
      'utf8',
    );

    const registry = new ValidationRegistry();
    registry.register(new MissingImportsRule());
    const engine = new ValidationEngine({ registry });
    const result = await engine.validate(workspacePath);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.ruleId === 'missing-imports')).toBe(true);
  });

  it('detecta archivos generados faltantes', async () => {
    const workspacePath = await createValidWorkspace();
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);
    await history.initialize();

    await rm(join(workspacePath, 'netlify/functions/database_insert.ts'), { force: true });

    const registry = new ValidationRegistry();
    registry.register(new GeneratedFilesRule());
    const engine = new ValidationEngine({ registry });
    const result = await engine.validateContext(
      new ValidationContext({
        projectPath: '/tmp/original',
        workspacePath,
        history,
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.failedTransformationIds.length).toBeGreaterThan(0);
  });
});

describe('RollbackManager', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('restaura un fragmento reescrito desde TransformationHistory', async () => {
    const workspacePath = await createWorkspaceWithRewrite();
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);
    await history.initialize();

    const rewriteRecord = history
      .getRecords()
      .find((record) => record.rewriteRule === 'DatabaseInsertRewriteRule');

    expect(rewriteRecord).toBeDefined();

    const manager = new RollbackManager();
    const result = await manager.rollback(
      rewriteRecord!.id,
      new RollbackContext({
        workspacePath,
        history,
        reason: 'Prueba de rollback parcial',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.actions.some((action) => action.type === 'RESTORE_SNIPPET')).toBe(true);

    const appContent = await readFile(join(workspacePath, 'src/App.tsx'), 'utf8');
    expect(appContent).toContain("addDoc(collection(db, 'users'), { name: 'Ana' })");

    const updated = history.getById(rewriteRecord!.id);
    expect(updated?.rollbackExecuted).toBe(true);
    expect(updated?.rollbackReason).toBe('Prueba de rollback parcial');
  });

  it('elimina archivos generados en rollback completo de function', async () => {
    const workspacePath = await createValidWorkspace();
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);
    await history.initialize();

    const functionRecord = history
      .getRecords()
      .find((record) => record.operation === 'GENERATE_FUNCTION');

    expect(functionRecord).toBeDefined();

    const manager = new RollbackManager();
    const result = await manager.rollback(
      functionRecord!.id,
      new RollbackContext({
        workspacePath,
        history,
        reason: 'Rollback de function generada',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.actions.some((action) => action.type === 'DELETE_GENERATED')).toBe(true);
  });

  it('no elimina otras transformaciones válidas al revertir una específica', async () => {
    const workspacePath = await createValidWorkspace();
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);
    await history.initialize();

    const functionRecord = history
      .getRecords()
      .find((record) => record.operation === 'GENERATE_FUNCTION');
    const sdkRecord = history.getRecords().find((record) => record.operation === 'GENERATE_SDK');

    const manager = new RollbackManager();
    await manager.rollback(
      functionRecord!.id,
      new RollbackContext({ workspacePath, history }),
    );

    const sdkPath = join(workspacePath, 'sdk/index.ts');
    await expect(readFile(sdkPath, 'utf8')).resolves.toContain('Funimas');

    const untouchedSdk = history.getById(sdkRecord!.id);
    expect(untouchedSdk?.rollbackExecuted).toBe(false);
  });
});

describe('ValidationReportGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('genera validation.md, validation.html y validation.json', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-validation-report-'));
    tempDirs.push(workspacePath);

    const registry = new ValidationRegistry();
    registry.register(new SDKStructureRule());
    const engine = new ValidationEngine({ registry });
    const result = await engine.validate(workspacePath);

    const generator = new ValidationReportGenerator();
    const report = await generator.generate(workspacePath, result, [], 'exec-1', new Date());

    const markdown = await readFile(report.markdownPath, 'utf8');
    const html = await readFile(report.htmlPath, 'utf8');
    const json = JSON.parse(await readFile(report.jsonPath, 'utf8')) as Record<string, unknown>;

    expect(markdown).toContain('Validation Report');
    expect(html).toContain('<html');
    expect(json.executionId).toBe('exec-1');
    expect(json.ruleResults).toBeDefined();
  });
});

describe('TransformationHistory validation fields', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('persiste validationStatus, rollbackExecuted y validationErrors', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-history-validation-'));
    tempDirs.push(workspacePath);
    const history = new TransformationHistory(workspacePath);

    const record = await history.record({
      file: join(workspacePath, 'src/App.tsx'),
      operation: 'DATABASE_INSERT',
      rewriteRule: 'DatabaseInsertRewriteRule',
      before: 'before',
      after: 'after',
      generatedFiles: [],
      modifiedImports: [],
      status: 'COMPLETED',
      validationStatus: 'PASSED',
      executionTime: 42,
    });

    await history.updateRecord(record.id, {
      validationStatus: 'FAILED',
      rollbackExecuted: true,
      rollbackReason: 'Validación fallida',
      validationErrors: ['Error de compilación'],
      status: 'FAILED',
    });

    const reloaded = new TransformationHistory(workspacePath);
    await reloaded.initialize();
    const updated = reloaded.getById(record.id);

    expect(updated?.validationStatus).toBe('FAILED');
    expect(updated?.rollbackExecuted).toBe(true);
    expect(updated?.rollbackReason).toBe('Validación fallida');
    expect(updated?.validationErrors).toEqual(['Error de compilación']);
    expect(updated?.executionTime).toBe(42);
  });
});
