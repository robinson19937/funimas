import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ProtectPipeline } from '../src/pipeline/ProtectPipeline.js';
import { NullOutputWriter } from '../src/utils/output.js';
import { CaptureOutputWriter } from './helpers/capture-output-writer.js';

describe('ProtectPipeline platform regression', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
        await rm(`${dir}_funimas`, { recursive: true, force: true });
      }),
    );
  });

  it('genera runtime y sdk aunque no se detecte plataforma', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-no-platform-'));
    tempDirs.push(projectDir);

    await writeFile(
      join(projectDir, 'app.js'),
      "import { addDoc, collection } from 'firebase/firestore';\nexport const create = (db) => addDoc(collection(db, 'items'), {});\n",
      'utf8',
    );

    const pipeline = new ProtectPipeline({
      projectPath: projectDir,
      output: new NullOutputWriter(),
    });

    const result = await pipeline.execute();

    const workspacePath = result.workspaceResult.workspaceProject;

    await expect(stat(join(workspacePath, 'runtime/handler.ts'))).resolves.toBeDefined();
    await expect(stat(join(workspacePath, 'sdk/index.ts'))).resolves.toBeDefined();
    await expect(stat(join(workspacePath, 'tsconfig.json'))).resolves.toBeDefined();
  });

  it('detecta Netlify desde el proyecto original si el workspace no tiene netlify.toml', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-netlify-fallback-'));
    tempDirs.push(projectDir);
    const workspacePath = `${projectDir}_funimas`;

    await writeFile(
      join(projectDir, 'netlify.toml'),
      '[build]\n  functions = "netlify/functions"\n',
      'utf8',
    );
    await writeFile(
      join(projectDir, 'app.js'),
      "import { addDoc, collection } from 'firebase/firestore';\nexport const create = (db) => addDoc(collection(db, 'items'), {});\n",
      'utf8',
    );

    const { cp, rm: removeFile } = await import('node:fs/promises');
    await cp(projectDir, workspacePath, { recursive: true });
    await removeFile(join(workspacePath, 'netlify.toml'), { force: true });

    const output = new CaptureOutputWriter();
    const pipeline = new ProtectPipeline({
      projectPath: projectDir,
      output,
      workspaceEngine: {
        create: async () => ({
          originalProject: projectDir,
          workspaceProject: workspacePath,
          filesCopied: 1,
          startedAt: new Date(),
          finishedAt: new Date(),
        }),
      },
    });

    await pipeline.execute();

    expect(output.lines.some((line) => line.includes('✔ Netlify'))).toBe(true);
    await expect(stat(join(workspacePath, 'netlify/functions/database_insert.ts'))).resolves.toBeDefined();
  });

  it('registra qué generadores se ejecutan y cuáles se omiten', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-generation-log-'));
    tempDirs.push(projectDir);

    await writeFile(join(projectDir, 'app.js'), 'export const value = 1;\n', 'utf8');

    const output = new CaptureOutputWriter();
    const pipeline = new ProtectPipeline({
      projectPath: projectDir,
      output,
    });

    await pipeline.execute();

    expect(output.lines).toContain('Plan de generación:');
    expect(output.lines).toContain('✔ RuntimeGenerator — siempre');
    expect(output.lines).toContain('✔ SDKGenerator — siempre');
    expect(output.lines.some((line) => line.includes('⊘ FunctionGenerator — omitido'))).toBe(true);
    expect(output.lines.some((line) => line.includes('Motivo:'))).toBe(true);
  });
});
