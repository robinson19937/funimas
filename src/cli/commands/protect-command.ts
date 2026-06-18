import { resolve } from 'node:path';

import { BackupEngine, type BackupService } from '../../backup/index.js';
import { AstParser, type AstParserService } from '../../parser/index.js';
import { ProjectScanner, type ProjectScannerService } from '../../scanner/index.js';
import type { ScanResult } from '../../scanner/ScanResult.js';
import { ConsoleOutputWriter, NullOutputWriter, type OutputWriter } from '../../utils/index.js';
import { WorkspaceEngine, type WorkspaceService } from '../../workspace/index.js';
import type { WorkspaceResult } from '../../workspace/WorkspaceResult.js';

export interface ProtectCommandOptions {
  projectPath: string;
  output?: OutputWriter;
  backupEngine?: BackupService;
  workspaceEngine?: WorkspaceService;
  astParser?: AstParserService;
  projectScanner?: ProjectScannerService;
}

export class ProtectCommand {
  private readonly projectPath: string;
  private readonly output: OutputWriter;
  private readonly backupEngine: BackupService;
  private readonly workspaceEngine: WorkspaceService;
  private readonly astParser: AstParserService;
  private readonly projectScanner: ProjectScannerService;

  constructor(options: ProtectCommandOptions) {
    this.projectPath = resolve(options.projectPath);
    this.output = options.output ?? new ConsoleOutputWriter();
    this.backupEngine =
      options.backupEngine ?? new BackupEngine({ output: new NullOutputWriter() });
    this.workspaceEngine = options.workspaceEngine ?? new WorkspaceEngine();
    this.astParser = options.astParser ?? new AstParser();
    this.projectScanner = options.projectScanner ?? new ProjectScanner();
  }

  async execute(): Promise<ScanResult> {
    await this.backupEngine.create(this.projectPath);
    const workspaceResult = await this.workspaceEngine.create(this.projectPath);

    this.printWorkspaceSummary(workspaceResult);

    const parseResult = await this.astParser.parse(workspaceResult.workspaceProject);

    this.output.writeln('Analizando estructura...');
    this.output.writeln();

    const scanResult = await this.projectScanner.scan(parseResult.project);

    this.printScanSummary(scanResult);

    return scanResult;
  }

  private printWorkspaceSummary(workspaceResult: WorkspaceResult): void {
    this.output.writeln('Funimas');
    this.output.writeln();
    this.output.writeln('✔ Backup creado');
    this.output.writeln();
    this.output.writeln('✔ Workspace creado');
    this.output.writeln();
    this.output.writeln('Proyecto original:');
    this.output.writeln();
    this.output.writeln(workspaceResult.originalProject);
    this.output.writeln();
    this.output.writeln('Proyecto de trabajo:');
    this.output.writeln();
    this.output.writeln(workspaceResult.workspaceProject);
    this.output.writeln();
  }

  private printScanSummary(scanResult: ScanResult): void {
    this.output.writeln(`✔ ${scanResult.totalFiles} archivos`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalImports} imports`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalFunctions} funciones`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalClasses} clases`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalInterfaces} interfaces`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalEnums} enums`);
  }
}
