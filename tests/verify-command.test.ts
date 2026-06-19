import { access } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { VerifyCommand } from '../src/cli/commands/verify-command.js';
import type { WorkspaceVerificationReport } from '../src/verify/index.js';

describe('VerifyCommand', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('devuelve 1 cuando el workspace no existe', async () => {
    const command = new VerifyCommand({
      workspacePath: '/ruta/inexistente/funimas_workspace',
    });

    await expect(command.execute()).resolves.toBe(1);
  });

  it('devuelve 0 cuando la verificación funcional pasa', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-verify-cmd-'));
    tempDirs.push(workspacePath);

    const report: WorkspaceVerificationReport = {
      ready: true,
      workspacePath,
      checks: [
        {
          id: 'workspace-structure',
          name: 'Estructura del workspace',
          passed: true,
          level: 'error',
          message: 'OK',
        },
      ],
      untransformedOperations: [],
      durationMs: 10,
      finishedAt: new Date(),
    };

    const command = new VerifyCommand({
      workspacePath,
      skipBuild: true,
      workspaceVerifier: {
        verify: async () => report,
      } as never,
    });

    await expect(command.execute()).resolves.toBe(0);
    await expect(access(join(workspacePath, '.funimas/reports/verify.json'))).resolves.toBeUndefined();
  });

  it('devuelve 1 cuando hay operaciones sin transformar bloqueantes', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-verify-fail-'));
    tempDirs.push(workspacePath);
    await mkdir(workspacePath, { recursive: true });

    const report: WorkspaceVerificationReport = {
      ready: false,
      workspacePath,
      checks: [
        {
          id: 'untransformed-operations',
          name: 'Operaciones Firestore',
          passed: false,
          level: 'error',
          message: '1 operación sin transformar',
        },
      ],
      untransformedOperations: [
        {
          file: 'src/App.tsx',
          line: 12,
          callee: 'runTransaction',
          operationType: 'CUSTOM',
          reason: 'unsupported-api',
          recommendation: 'Migrar manualmente',
          blocking: true,
        },
      ],
      durationMs: 10,
      finishedAt: new Date(),
    };

    const command = new VerifyCommand({
      workspacePath,
      skipBuild: true,
      workspaceVerifier: {
        verify: async () => report,
      } as never,
    });

    await expect(command.execute()).resolves.toBe(1);
  });
});
