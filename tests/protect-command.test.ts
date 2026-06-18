import { describe, expect, it, vi } from 'vitest';

import { BackupResult } from '../src/backup/BackupResult.js';
import type { BackupService } from '../src/backup/BackupEngine.js';
import { ProtectCommand } from '../src/cli/commands/protect-command.js';
import type { OutputWriter } from '../src/utils/output.js';

class MockOutputWriter implements OutputWriter {
  readonly lines: string[] = [];

  writeln(message = ''): void {
    this.lines.push(message);
  }
}

describe('ProtectCommand', () => {
  it('muestra la versión, la ruta del proyecto y ejecuta el backup', async () => {
    const output = new MockOutputWriter();
    const backupResult = new BackupResult({
      backupPath: '/tmp/mi-proyecto/.funimas/backups/2026-06-18_14-35-22',
      relativeBackupPath: '.funimas/backups/2026-06-18_14-35-22',
      filesCopied: 12,
      startedAt: new Date('2026-06-18T14:35:22.000Z'),
      finishedAt: new Date('2026-06-18T14:35:23.000Z'),
    });
    const backupEngine: BackupService = {
      create: vi.fn().mockResolvedValue(backupResult),
    };

    const command = new ProtectCommand({
      projectPath: './mi-proyecto',
      output,
      backupEngine,
    });

    await command.execute();

    expect(backupEngine.create).toHaveBeenCalledOnce();
    expect(backupEngine.create).toHaveBeenCalledWith(expect.stringContaining('mi-proyecto'));

    expect(output.lines.slice(0, 7)).toEqual([
      'Funimas v0.1.0',
      '',
      'Proyecto:',
      expect.stringContaining('mi-proyecto'),
      '',
      'Inicializando...',
      '',
    ]);
  });
});
