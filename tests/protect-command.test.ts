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
import { TransformationPlan } from '../src/planner/TransformationPlan.js';
import { PlannerResult } from '../src/planner/PlannerResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';
import type { TransformationPlannerService } from '../src/planner/TransformationPlanner.js';
import { NetlifyAdapter } from '../src/adapters/index.js';
import type { AdapterRegistryService } from '../src/adapters/index.js';
import { GeneratorResult } from '../src/generator/GeneratorResult.js';
import type {
  FunctionGeneratorService,
  SDKGeneratorService,
} from '../src/generator/index.js';
import { RuntimeResult } from '../src/runtime/RuntimeResult.js';
import type { RuntimeGeneratorService } from '../src/runtime/index.js';
import { RewriteResult, createEmptyOperationsRewritten } from '../src/rewriter/RewriteResult.js';
import type { CodeRewriterService } from '../src/rewriter/index.js';
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
    const plannerResult = new PlannerResult({
      plan: new TransformationPlan(),
      totalActions: 18,
      actionsByType: {
        ...createEmptyActionsByType(),
        GENERATE_RUNTIME: 1,
        GENERATE_SDK: 1,
        GENERATE_FUNCTION: 6,
        REWRITE_CODE: 12,
        UPDATE_IMPORTS: 12,
        VALIDATE_PROJECT: 1,
      },
      estimatedModifiedFiles: 4,
      estimatedGeneratedFiles: 8,
      estimatedExecutionTime: 12000,
      startedAt: new Date('2026-06-18T14:35:32.000Z'),
      finishedAt: new Date('2026-06-18T14:35:33.000Z'),
    });
    const transformationPlanner: TransformationPlannerService = {
      plan: vi.fn().mockReturnValue(plannerResult),
    };
    const adapterRegistry: AdapterRegistryService = {
      register: vi.fn(),
      registerMany: vi.fn(),
      getAdapters: vi.fn().mockReturnValue([]),
      getAdapter: vi.fn(),
      detect: vi.fn().mockResolvedValue({
        detected: true,
        adapter: new NetlifyAdapter(),
      }),
    };
    const backendRuntimeGenerator: RuntimeGeneratorService = {
      generate: vi.fn().mockResolvedValue(
        new RuntimeResult({
          generatedFiles: [
            {
              fileName: 'handler.ts',
              relativePath: 'runtime/handler.ts',
              absolutePath: '/tmp/mi-proyecto_funimas/runtime/handler.ts',
            },
            {
              fileName: 'router.ts',
              relativePath: 'runtime/router.ts',
              absolutePath: '/tmp/mi-proyecto_funimas/runtime/router.ts',
            },
            {
              fileName: 'databaseController.ts',
              relativePath: 'runtime/controllers/databaseController.ts',
              absolutePath: '/tmp/mi-proyecto_funimas/runtime/controllers/databaseController.ts',
            },
            {
              fileName: 'firestoreRepository.ts',
              relativePath: 'runtime/repositories/firestoreRepository.ts',
              absolutePath: '/tmp/mi-proyecto_funimas/runtime/repositories/firestoreRepository.ts',
            },
          ],
          startedAt: new Date('2026-06-18T14:35:34.000Z'),
          finishedAt: new Date('2026-06-18T14:35:34.500Z'),
        }),
      ),
    };
    const sdkGenerator: SDKGeneratorService = {
      generate: vi.fn().mockResolvedValue(
        new GeneratorResult({
          files: [],
          runtimeGenerated: false,
          sdkGenerated: true,
          functionFileNames: [],
          startedAt: new Date('2026-06-18T14:35:35.000Z'),
          finishedAt: new Date('2026-06-18T14:35:35.000Z'),
        }),
      ),
    };
    const functionGenerator: FunctionGeneratorService = {
      generate: vi.fn().mockResolvedValue(
        new GeneratorResult({
          files: [],
          runtimeGenerated: false,
          sdkGenerated: false,
          functionFileNames: ['database_insert.ts'],
          startedAt: new Date('2026-06-18T14:35:36.000Z'),
          finishedAt: new Date('2026-06-18T14:35:36.000Z'),
        }),
      ),
    };

    const codeRewriter: CodeRewriterService = {
      rewrite: vi.fn().mockResolvedValue(
        new RewriteResult({
          modifiedFiles: ['App.tsx', 'clientes.ts'],
          operationsRewritten: {
            ...createEmptyOperationsRewritten(),
            DATABASE_INSERT: 1,
          },
          importsAdded: ['@funimas/sdk:Funimas'],
          importsRemoved: ['addDoc'],
          startedAt: new Date('2026-06-18T14:35:37.000Z'),
          finishedAt: new Date('2026-06-18T14:35:38.000Z'),
        }),
      ),
    };

    const changeReportGenerator = {
      generate: vi.fn().mockResolvedValue({
        markdownPath: '/tmp/report/changes.md',
        htmlPath: '/tmp/report/changes.html',
        summaryPath: '/tmp/report/summary.json',
        summary: {},
      }),
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
      transformationPlanner,
      adapterRegistry,
      backendRuntimeGenerator,
      sdkGenerator,
      functionGenerator,
      codeRewriter,
      changeReportGenerator,
    });

    const result = await command.execute();

    expect(semanticAnalyzer.analyze).toHaveBeenCalledOnce();
    expect(transformationPlanner.plan).toHaveBeenCalledOnce();
    expect(transformationPlanner.plan).toHaveBeenCalledWith(semanticResult);
    expect(result).toBe(plannerResult);

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
    expect(output.lines).toContain('Planificando transformación...');
    expect(output.lines).toContain('✔ Acciones: 18');
    expect(output.lines).toContain('✔ Runtime: 1');
    expect(output.lines).toContain('✔ SDK: 1');
    expect(output.lines).toContain('✔ Functions: 6');
    expect(output.lines).toContain('✔ Rewrites: 12');
    expect(output.lines).toContain('✔ Imports: 12');
    expect(output.lines).toContain('✔ Validaciones: 1');
    expect(output.lines).toContain('Detectando plataforma...');
    expect(output.lines).toContain('✔ Netlify');
    expect(output.lines).toContain('Capabilities');
    expect(output.lines).toContain('✔ Runtime');
    expect(output.lines).toContain('✔ Functions');
    expect(output.lines).toContain('✔ Environment');
    expect(output.lines).toContain('Generando SDK...');
    expect(output.lines).toContain('Generando Functions...');
    expect(output.lines).toContain('Generando Runtime...');
    expect(output.lines).toContain('✔ handler.ts');
    expect(output.lines).toContain('✔ databaseController.ts');
    expect(output.lines).toContain('✔ firestoreRepository.ts');
    expect(output.lines).toContain('✔ database_insert.ts');
    expect(backendRuntimeGenerator.generate).toHaveBeenCalledOnce();
    expect(sdkGenerator.generate).toHaveBeenCalledOnce();
    expect(functionGenerator.generate).toHaveBeenCalledOnce();
    expect(output.lines).toContain('Reescribiendo código...');
    expect(output.lines).toContain('✔ App.tsx');
    expect(output.lines).toContain('Operaciones transformadas:');
    expect(output.lines).toContain('DATABASE_INSERT: 1');
    expect(codeRewriter.rewrite).toHaveBeenCalledOnce();
    expect(output.lines).toContain('Registrando transformaciones...');
    expect(output.lines).toContain('Generando reporte...');
    expect(output.lines).toContain('✔ changes.md');
    expect(output.lines).toContain('✔ summary.json');
    expect(changeReportGenerator.generate).toHaveBeenCalledOnce();
  });
});
