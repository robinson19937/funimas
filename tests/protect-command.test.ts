import { describe, expect, it, vi } from 'vitest';

import { BackupResult } from '../src/backup/BackupResult.js';
import type { BackupService } from '../src/backup/BackupEngine.js';
import { ProtectCommand } from '../src/cli/commands/protect-command.js';
import { DependencyGraph } from '../src/graph/DependencyGraph.js';
import { GraphResult } from '../src/graph/GraphResult.js';
import type { GraphBuilderService } from '../src/graph/GraphBuilder.js';
import { AstParserResult } from '../src/parser/AstParserResult.js';
import { AstProject } from '../src/parser/AstProject.js';
import type { AstParserService } from '../src/parser/AstParser.js';
import { ScanResult } from '../src/scanner/ScanResult.js';
import type { ProjectScannerService } from '../src/scanner/ProjectScanner.js';
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
  it('ejecuta backup, workspace, parser, scanner y grafo mostrando el resumen final', async () => {
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
    const astProject = new AstProject({
      projectPath: '/tmp/mi-proyecto_funimas',
      totalFiles: 58,
      totalTypescriptFiles: 46,
      totalJavascriptFiles: 12,
      sourceFiles: [],
    });
    const parseResult = new AstParserResult({
      project: astProject,
      startedAt: new Date('2026-06-18T14:35:24.000Z'),
      finishedAt: new Date('2026-06-18T14:35:25.000Z'),
    });
    const scanResult = new ScanResult({
      projectPath: '/tmp/mi-proyecto_funimas',
      files: [],
      totalFiles: 58,
      totalImports: 241,
      totalFunctions: 86,
      totalClasses: 12,
      totalInterfaces: 7,
      totalEnums: 2,
      totalVariables: 5,
      startedAt: new Date('2026-06-18T14:35:26.000Z'),
      finishedAt: new Date('2026-06-18T14:35:27.000Z'),
    });
    const graphResult = new GraphResult({
      graph: new DependencyGraph(),
      totalNodes: 58,
      totalEdges: 214,
      totalImports: 214,
      totalConnectedComponents: 1,
      startedAt: new Date('2026-06-18T14:35:28.000Z'),
      finishedAt: new Date('2026-06-18T14:35:29.000Z'),
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
    const projectScanner: ProjectScannerService = {
      scan: vi.fn().mockResolvedValue(scanResult),
    };
    const graphBuilder: GraphBuilderService = {
      build: vi.fn().mockReturnValue(graphResult),
    };

    const command = new ProtectCommand({
      projectPath: './mi-proyecto',
      output,
      backupEngine,
      workspaceEngine,
      astParser,
      projectScanner,
      graphBuilder,
    });

    const result = await command.execute();

    expect(graphBuilder.build).toHaveBeenCalledOnce();
    expect(graphBuilder.build).toHaveBeenCalledWith(scanResult);
    expect(result).toBe(graphResult);

    expect(output.lines).toContain('Construyendo Dependency Graph...');
    expect(output.lines).toContain('✔ Nodos: 58');
    expect(output.lines).toContain('✔ Relaciones: 214');
    expect(output.lines).toContain('✔ Componentes: 1');
  });
});
