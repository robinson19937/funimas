import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { CliApp } from '../src/cli/cli.js';
import { ProtectPipeline } from '../src/pipeline/ProtectPipeline.js';
import { ProjectValidator } from '../src/pipeline/ProjectValidator.js';
import { NullOutputWriter } from '../src/utils/output.js';

const examplesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');
const reactFirebaseCrudPath = join(examplesDir, 'react-firebase-crud');

describe('MVP funimas protect', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
        await rm(`${dir}_funimas`, { recursive: true, force: true });
      }),
    );
    await rm(`${reactFirebaseCrudPath}_funimas`, { recursive: true, force: true });
    await rm(join(reactFirebaseCrudPath, '.funimas'), { recursive: true, force: true });
  });

  it('ejecuta el pipeline completo sobre react-firebase-crud', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-mvp-pipeline-'));
    tempDirs.push(projectDir);
    await cp(reactFirebaseCrudPath, projectDir, { recursive: true });

    const originalApp = await readFile(join(projectDir, 'src/App.tsx'), 'utf8');

    const pipeline = new ProtectPipeline({
      projectPath: projectDir,
      output: new NullOutputWriter(),
    });

    const result = await pipeline.execute();

    expect(result.success).toBe(true);
    expect(result.validationResult.valid).toBe(true);
    expect(result.transformationsRegistered).toBeGreaterThan(0);
    expect(result.workspaceResult.originalProject).toBe(projectDir);
    expect(result.workspaceResult.workspaceProject).toBe(`${projectDir}_funimas`);

    const workspaceApp = await readFile(
      join(result.workspaceResult.workspaceProject, 'src/App.tsx'),
      'utf8',
    );
    const untouchedApp = await readFile(join(projectDir, 'src/App.tsx'), 'utf8');

    expect(workspaceApp).toContain('Funimas.database.insert');
    expect(untouchedApp).toBe(originalApp);

    await expect(
      stat(join(result.workspaceResult.workspaceProject, 'runtime/handler.ts')),
    ).resolves.toBeDefined();
    await expect(
      stat(join(result.workspaceResult.workspaceProject, 'sdk/index.ts')),
    ).resolves.toBeDefined();
    await expect(
      stat(join(result.workspaceResult.workspaceProject, 'netlify/functions/database_insert.ts')),
    ).resolves.toBeDefined();
    await expect(
      stat(join(result.reportsDirectory, 'changes.md')),
    ).resolves.toBeDefined();
    await expect(
      stat(join(result.reportsDirectory, 'validation.json')),
    ).resolves.toBeDefined();
  });

  it('rechaza rutas de proyecto inválidas', async () => {
    const validator = new ProjectValidator();

    await expect(validator.validate('/ruta/que/no/existe')).rejects.toThrow(
      'El proyecto no existe',
    );
  });

  it('funciona vía CLI global con npm link', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-mvp-cli-'));
    tempDirs.push(projectDir);
    await cp(reactFirebaseCrudPath, projectDir, { recursive: true });

    const app = new CliApp({
      argv: ['node', 'funimas', 'protect', projectDir],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(0);
    await expect(stat(`${projectDir}_funimas/runtime/handler.ts`)).resolves.toBeDefined();
    await expect(stat(join(projectDir, 'src/App.tsx'))).resolves.toBeDefined();
  });
});
