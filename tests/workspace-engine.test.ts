import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { WorkspaceEngine } from '../src/workspace/WorkspaceEngine.js';
import { WorkspaceError } from '../src/workspace/WorkspaceUtils.js';

describe('WorkspaceEngine', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
        await rm(`${dir}_funimas`, { recursive: true, force: true });
      }),
    );
  });

  async function createTempProject(structure: Record<string, string>): Promise<string> {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-workspace-'));
    tempDirs.push(projectDir);

    for (const [relativePath, content] of Object.entries(structure)) {
      const filePath = join(projectDir, relativePath);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, content, 'utf8');
    }

    return projectDir;
  }

  it('crea un workspace junto al proyecto conservando la estructura', async () => {
    const fixedDate = new Date(2026, 5, 18, 14, 35, 22);
    const projectDir = await createTempProject({
      'package.json': '{"name":"crm"}',
      'src/app.ts': 'export const app = true;',
      'node_modules/pkg/index.js': 'ignored',
      '.git/config': 'ignored',
      'dist/app.js': 'ignored',
      'coverage/lcov.info': 'ignored',
      '.funimas/config.json': 'ignored',
    });

    const engine = new WorkspaceEngine({
      now: () => fixedDate,
    });

    const result = await engine.create(projectDir);
    const workspaceDir = `${projectDir}_funimas`;

    expect(result.originalProject).toBe(projectDir);
    expect(result.workspaceProject).toBe(workspaceDir);
    expect(result.filesCopied).toBe(2);
    expect(result.startedAt).toEqual(fixedDate);
    expect(result.finishedAt).toEqual(fixedDate);
    expect(result.duration).toBe(0);
    expect(basename(workspaceDir)).toBe(`${basename(projectDir)}_funimas`);

    await expect(readFile(join(workspaceDir, 'package.json'), 'utf8')).resolves.toBe(
      '{"name":"crm"}',
    );
    await expect(readFile(join(workspaceDir, 'src', 'app.ts'), 'utf8')).resolves.toBe(
      'export const app = true;',
    );

    await expect(readFile(join(workspaceDir, 'node_modules', 'pkg', 'index.js'), 'utf8')).rejects
      .toThrow();
    await expect(readFile(join(workspaceDir, '.git', 'config'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(workspaceDir, 'dist', 'app.js'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(workspaceDir, 'coverage', 'lcov.info'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(workspaceDir, '.funimas', 'config.json'), 'utf8')).rejects.toThrow();
  });

  it('sobrescribe el workspace existente cuando force=true', async () => {
    const projectDir = await createTempProject({
      'package.json': '{"name":"crm"}',
      'src/app.ts': 'export const app = true;',
    });
    const workspaceDir = `${projectDir}_funimas`;
    await mkdir(workspaceDir, { recursive: true });
    await writeFile(join(workspaceDir, 'old.txt'), 'stale', 'utf8');

    const engine = new WorkspaceEngine();
    const result = await engine.create(projectDir, { force: true });

    expect(result.workspaceProject).toBe(workspaceDir);
    await expect(readFile(join(workspaceDir, 'package.json'), 'utf8')).resolves.toBe(
      '{"name":"crm"}',
    );
    await expect(readFile(join(workspaceDir, 'old.txt'), 'utf8')).rejects.toThrow();
  });

  it('lanza WorkspaceError cuando el workspace ya existe', async () => {
    const projectDir = await createTempProject({
      'README.md': '# Demo',
    });
    const workspaceDir = `${projectDir}_funimas`;
    await mkdir(workspaceDir, { recursive: true });

    const engine = new WorkspaceEngine();

    await expect(engine.create(projectDir)).rejects.toThrow(WorkspaceError);
    await expect(engine.create(projectDir)).rejects.toThrow('El workspace ya existe:');
  });

  it('lanza WorkspaceError cuando el proyecto no existe', async () => {
    const engine = new WorkspaceEngine();

    await expect(engine.create('/ruta/inexistente/funimas')).rejects.toThrow(WorkspaceError);
    await expect(engine.create('/ruta/inexistente/funimas')).rejects.toThrow(
      'El proyecto no existe:',
    );
  });
});
