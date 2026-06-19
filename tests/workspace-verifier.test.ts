import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { WorkspaceVerifier } from '../src/verify/WorkspaceVerifier.js';

describe('WorkspaceVerifier', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('falla cuando faltan archivos esenciales del workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-verify-missing-'));
    tempDirs.push(workspacePath);

    const verifier = new WorkspaceVerifier({
      runCommand: async () => ({ stdout: '', stderr: '' }),
    });

    const report = await verifier.verify(workspacePath, {
      skipBuild: true,
      skipDeployReadiness: true,
    });

    expect(report.ready).toBe(false);
    expect(report.checks.find((check) => check.id === 'workspace-structure')?.passed).toBe(false);
  });

  it('pasa la estructura mínima y omite build cuando se solicita', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-verify-ok-'));
    tempDirs.push(workspacePath);

    await mkdir(join(workspacePath, 'runtime'), { recursive: true });
    await mkdir(join(workspacePath, 'sdk'), { recursive: true });
    await writeFile(join(workspacePath, 'runtime/handler.ts'), 'export {};\n', 'utf8');
    await writeFile(join(workspacePath, 'sdk/index.ts'), 'export const Funimas = {};\n', 'utf8');
    await writeFile(join(workspacePath, 'funimas.config.json'), '{"allowedCollections":[]}\n', 'utf8');
    await writeFile(join(workspacePath, 'firestore.rules'), 'rules_version = "2";\n', 'utf8');
    await writeFile(join(workspacePath, 'package.json'), '{"name":"demo","scripts":{}}\n', 'utf8');

    const verifier = new WorkspaceVerifier({
      runCommand: async () => ({ stdout: '', stderr: '' }),
    });

    const report = await verifier.verify(workspacePath, {
      skipBuild: true,
      skipDeployReadiness: true,
    });

    expect(report.checks.find((check) => check.id === 'workspace-structure')?.passed).toBe(true);
    expect(report.checks.find((check) => check.id === 'npm-build')).toBeUndefined();
  });

  it('ejecuta npm install y build cuando no se omite', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-verify-build-'));
    tempDirs.push(workspacePath);

    await mkdir(join(workspacePath, 'runtime'), { recursive: true });
    await mkdir(join(workspacePath, 'sdk'), { recursive: true });
    await writeFile(join(workspacePath, 'runtime/handler.ts'), 'export {};\n', 'utf8');
    await writeFile(join(workspacePath, 'sdk/index.ts'), 'export const Funimas = {};\n', 'utf8');
    await writeFile(join(workspacePath, 'funimas.config.json'), '{"allowedCollections":[]}\n', 'utf8');
    await writeFile(join(workspacePath, 'firestore.rules'), 'rules_version = "2";\n', 'utf8');
    await writeFile(
      join(workspacePath, 'package.json'),
      '{"name":"demo","scripts":{"build":"echo ok"}}\n',
      'utf8',
    );

    const commands: string[][] = [];
    const verifier = new WorkspaceVerifier({
      runCommand: async (_command, args) => {
        commands.push(args);
        return { stdout: 'ok', stderr: '' };
      },
    });

    const report = await verifier.verify(workspacePath, {
      skipDeployReadiness: true,
    });

    expect(commands.some((args) => args[0] === 'install')).toBe(true);
    expect(commands.some((args) => args[0] === 'run' && args[1] === 'build')).toBe(true);
    expect(report.checks.find((check) => check.id === 'npm-build')?.passed).toBe(true);
  });
});
