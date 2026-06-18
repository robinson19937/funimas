import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { TransformationHistory } from '../src/history/TransformationHistory.js';
import { GeneratedFilesRule } from '../src/validation/rules/GeneratedFilesRule.js';
import { ValidationContext } from '../src/validation/ValidationContext.js';

describe('GeneratedFilesRule', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('resuelve rutas absolutas de Windows dentro del workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-generated-files-'));
    tempDirs.push(workspacePath);

    const functionsDir = join(workspacePath, 'netlify', 'functions');
    await mkdir(functionsDir, { recursive: true });
    await writeFile(join(functionsDir, 'database_insert.ts'), 'export const handler = () => ({ statusCode: 200, body: "" });\n', 'utf8');

    const history = new TransformationHistory(workspacePath);
    await history.initialize();
    await history.record({
      file: join(workspacePath, 'netlify', 'functions', 'database_insert.ts'),
      operation: 'GENERATE_FUNCTION',
      rewriteRule: 'DatabaseInsertFunctionGenerator',
      before: '',
      after: 'generated',
      generatedFiles: ['netlify/functions/database_insert.ts'],
      modifiedImports: [],
      status: 'COMPLETED',
    });

    const rule = new GeneratedFilesRule();
    const result = await rule.validate(
      new ValidationContext({
        projectPath: '/tmp/original',
        workspacePath,
        history,
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
