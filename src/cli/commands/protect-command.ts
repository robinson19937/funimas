import { resolve } from 'node:path';

import { BackupEngine, type BackupService } from '../../backup/index.js';
import { AstParser, type AstParserService } from '../../parser/index.js';
import type { AstParserResult } from '../../parser/AstParserResult.js';
import { ConsoleOutputWriter, NullOutputWriter, type OutputWriter } from '../../utils/index.js';
import { WorkspaceEngine, type WorkspaceService } from '../../workspace/index.js';
import type { WorkspaceResult } from '../../workspace/WorkspaceResult.js';

export interface ProtectCommandOptions {
  projectPath: string;
  output?: OutputWriter;
  backupEngine?: BackupService;
  workspaceEngine?: WorkspaceService;
  astParser?: AstParserService;
}

export class ProtectCommand {
  private readonly projectPath: string;
  private readonly output: OutputWriter;
  private readonly backupEngine: BackupService;
  private readonly workspaceEngine: WorkspaceService;
  private readonly astParser: AstParserService;

  constructor(options: ProtectCommandOptions) {
    this.projectPath = resolve(options.projectPath);
    this.output = options.output ?? new ConsoleOutputWriter();
    this.backupEngine =
      options.backupEngine ?? new BackupEngine({ output: new NullOutputWriter() });
    this.workspaceEngine = options.workspaceEngine ?? new WorkspaceEngine();
    this.astParser = options.astParser ?? new AstParser();
  }

  async execute(): Promise<AstParserResult> {
    await this.backupEngine.create(this.projectPath);
    const workspaceResult = await this.workspaceEngine.create(this.projectPath);

    this.printWorkspaceSummary(workspaceResult);

    this.output.writeln('Analizando proyecto...');
    this.output.writeln();

    const parseResult = await this.astParser.parse(workspaceResult.workspaceProject);

    this.printAnalysisSummary(parseResult);

    return parseResult;
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

  private printAnalysisSummary(parseResult: AstParserResult): void {
    const { project } = parseResult;

    this.output.writeln('✔ Proyecto cargado');
    this.output.writeln();
    this.output.writeln(`Archivos encontrados: ${project.totalFiles}`);
    this.output.writeln();
    this.output.writeln(`TypeScript: ${project.totalTypescriptFiles}`);
    this.output.writeln();
    this.output.writeln(`JavaScript: ${project.totalJavascriptFiles}`);
  }
}
