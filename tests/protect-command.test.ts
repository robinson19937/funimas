import { describe, expect, it, vi } from 'vitest';

import { BackupResult } from '../src/backup/BackupResult.js';
import type { BackupService } from '../src/backup/BackupEngine.js';
import { ProtectCommand } from '../src/cli/commands/protect-command.js';
import { WorkspaceResult } from '../src/workspace/WorkspaceResult.js';
import type { WorkspaceService } from '../src/workspace/WorkspaceEngine.js';
import type { OutputWriter } from '../src/utils/output.js';

class MockOutputWriter implements OutputWriter {
  readonly lines: string[] = [];

  writeln(message = ''): void {
    this.lines.push(message);
  }
}

describe('ProtectCommand', () => {
  it('ejecuta backup y workspace, y muestra el resumen final', async () => {
    const output = new MockOutputWriter();
    const backupResult = new BackupResult({
      backupPath: '/tmp/mi-proyecto/.funimas/backups/2026-06-18_14-35-22',
      relativeBackupPath: '.funimas/backups/2026-06-18_14-35-22',
      filesCopied: 12,
      startedAt: new Date('2026-06-18T14:35:22.000Z'),
      finishedAt: new Date('2026-06-18T14:35:23.000Z'),
    });
    const workspaceResult = new WorkspaceResult({
      originalProject: '/tmp/mi-proyecto',
      workspaceProject: '/tmp/mi-proyecto_funimas',
      filesCopied: 12,
      startedAt: new Date('2026-06-18T14:35:22.000Z'),
      finishedAt: new Date('2026-06-18T14:35:23.000Z'),
    });
    const backupEngine: BackupService = {
      create: vi.fn().mockResolvedValue(backupResult),
    };
    const workspaceEngine: WorkspaceService = {
      create: vi.fn().mockResolvedValue(workspaceResult),
    };

    const command = new ProtectCommand({
      projectPath: './mi-proyecto',
      output,
      backupEngine,
      workspaceEngine,
    });

    const result = await command.execute();

    expect(backupEngine.create).toHaveBeenCalledOnce();
    expect(backupEngine.create).toHaveBeenCalledWith(expect.stringContaining('mi-proyecto'));
    expect(workspaceEngine.create).toHaveBeenCalledOnce();
    expect(workspaceEngine.create).toHaveBeenCalledWith(expect.stringContaining('mi-proyecto'));
    expect(result).toBe(workspaceResult);

    expect(output.lines).toEqual([
      'Funimas',
      '',
      '✔ Backup creado',
      '',
      '✔ Workspace creado',
      '',
      'Proyecto original:',
      '',
      '/tmp/mi-proyecto',
      '',
      'Proyecto de trabajo:',
      '',
      '/tmp/mi-proyecto_funimas',
    ]);
  });
});
