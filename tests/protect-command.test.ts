import { describe, expect, it, vi } from 'vitest';

import { BackupResult } from '../src/backup/BackupResult.js';
import type { BackupService } from '../src/backup/BackupEngine.js';
import { ProtectCommand } from '../src/cli/commands/protect-command.js';
import { AstParserResult } from '../src/parser/AstParserResult.js';
import { AstProject } from '../src/parser/AstProject.js';
import type { AstParserService } from '../src/parser/AstParser.js';
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
  it('ejecuta backup, workspace y análisis AST mostrando el resumen final', async () => {
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
    const parseResult = new AstParserResult({
      project: new AstProject({
        projectPath: '/tmp/mi-proyecto_funimas',
        totalFiles: 42,
        totalTypescriptFiles: 30,
        totalJavascriptFiles: 12,
        sourceFiles: [],
      }),
      startedAt: new Date('2026-06-18T14:35:24.000Z'),
      finishedAt: new Date('2026-06-18T14:35:25.000Z'),
    });
    const backupEngine: BackupService = {
      create: vi.fn().mockResolvedValue(backupResult),
    };
    const workspaceEngine: WorkspaceService = {
      create: vi.fn().mockResolvedValue(workspaceResult),
    };
    const astParser: AstParserService = {
      parse: vi.fn().mockResolvedValue(parseResult),
    };

    const command = new ProtectCommand({
      projectPath: './mi-proyecto',
      output,
      backupEngine,
      workspaceEngine,
      astParser,
    });

    const result = await command.execute();

    expect(backupEngine.create).toHaveBeenCalledOnce();
    expect(workspaceEngine.create).toHaveBeenCalledOnce();
    expect(astParser.parse).toHaveBeenCalledOnce();
    expect(astParser.parse).toHaveBeenCalledWith('/tmp/mi-proyecto_funimas');
    expect(result).toBe(parseResult);

    expect(output.lines).toContain('Analizando proyecto...');
    expect(output.lines).toContain('✔ Proyecto cargado');
    expect(output.lines).toContain('Archivos encontrados: 42');
    expect(output.lines).toContain('TypeScript: 30');
    expect(output.lines).toContain('JavaScript: 12');
  });
});
