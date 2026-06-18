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
import { SemanticOperation } from '../src/semantic/SemanticOperation.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import type { SemanticAnalyzerService } from '../src/semantic/SemanticAnalyzer.js';
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
  it('ejecuta todo el pipeline y muestra el resumen semántico', async () => {
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
    const semanticResult = new SemanticResult({
      operations: [
        new SemanticOperation({
          type: 'CUSTOM',
          file: '/tmp/mi-proyecto_funimas/src/app.ts',
          line: 1,
          column: 1,
          description: 'Import de Firebase detectado',
          metadata: { provider: 'firebase', category: 'import' },
        }),
        new SemanticOperation({
          type: 'DATABASE_INSERT',
          file: '/tmp/mi-proyecto_funimas/src/data.ts',
          line: 10,
          column: 3,
          description: 'addDoc',
          metadata: { provider: 'firebase', category: 'firestore' },
        }),
        new SemanticOperation({
          type: 'DATABASE_UPDATE',
          file: '/tmp/mi-proyecto_funimas/src/data.ts',
          line: 11,
          column: 3,
          description: 'updateDoc',
          metadata: { provider: 'firebase', category: 'firestore' },
        }),
        new SemanticOperation({
          type: 'DATABASE_DELETE',
          file: '/tmp/mi-proyecto_funimas/src/data.ts',
          line: 12,
          column: 3,
          description: 'deleteDoc',
          metadata: { provider: 'firebase', category: 'firestore' },
        }),
        new SemanticOperation({
          type: 'DATABASE_READ',
          file: '/tmp/mi-proyecto_funimas/src/data.ts',
          line: 13,
          column: 3,
          description: 'getDocs',
          metadata: { provider: 'firebase', category: 'firestore' },
        }),
        new SemanticOperation({
          type: 'AUTH_LOGIN',
          file: '/tmp/mi-proyecto_funimas/src/auth.ts',
          line: 5,
          column: 3,
          description: 'signIn',
          metadata: { provider: 'firebase', category: 'auth' },
        }),
        new SemanticOperation({
          type: 'AUTH_REGISTER',
          file: '/tmp/mi-proyecto_funimas/src/auth.ts',
          line: 6,
          column: 3,
          description: 'register',
          metadata: { provider: 'firebase', category: 'auth' },
        }),
        new SemanticOperation({
          type: 'FILE_UPLOAD',
          file: '/tmp/mi-proyecto_funimas/src/storage.ts',
          line: 7,
          column: 3,
          description: 'uploadBytes',
          metadata: { provider: 'firebase', category: 'storage' },
        }),
      ],
      totalOperations: 8,
      operationsByType: {
        DATABASE_INSERT: 1,
        DATABASE_UPDATE: 1,
        DATABASE_DELETE: 1,
        DATABASE_READ: 1,
        AUTH_LOGIN: 1,
        AUTH_REGISTER: 1,
        AUTH_LOGOUT: 0,
        FILE_UPLOAD: 1,
        FILE_DELETE: 0,
        CUSTOM: 1,
      },
      startedAt: new Date('2026-06-18T14:35:30.000Z'),
      finishedAt: new Date('2026-06-18T14:35:31.000Z'),
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
    const semanticAnalyzer: SemanticAnalyzerService = {
      analyze: vi.fn().mockResolvedValue(semanticResult),
    };

    const command = new ProtectCommand({
      projectPath: './mi-proyecto',
      output,
      backupEngine,
      workspaceEngine,
      astParser,
      projectScanner,
      graphBuilder,
      semanticAnalyzer,
    });

    const result = await command.execute();

    expect(semanticAnalyzer.analyze).toHaveBeenCalledOnce();
    expect(semanticAnalyzer.analyze).toHaveBeenCalledWith(graphResult);
    expect(result).toBe(semanticResult);

    expect(output.lines).toContain('Análisis semántico');
    expect(output.lines).toContain('✔ Firebase detectado');
    expect(output.lines).toContain('✔ Firestore');
    expect(output.lines).toContain('Insert: 1');
    expect(output.lines).toContain('Update: 1');
    expect(output.lines).toContain('Delete: 1');
    expect(output.lines).toContain('Read: 1');
    expect(output.lines).toContain('✔ Authentication');
    expect(output.lines).toContain('Login: 1');
    expect(output.lines).toContain('Register: 1');
    expect(output.lines).toContain('✔ Storage');
    expect(output.lines).toContain('Upload: 1');
  });
});
