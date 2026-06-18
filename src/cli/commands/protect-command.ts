import { resolve } from 'node:path';

import { BackupEngine, type BackupService } from '../../backup/index.js';
import { ConsoleOutputWriter, NullOutputWriter, type OutputWriter } from '../../utils/index.js';
import { WorkspaceEngine, type WorkspaceService } from '../../workspace/index.js';
import type { WorkspaceResult } from '../../workspace/WorkspaceResult.js';

export interface ProtectCommandOptions {
  projectPath: string;
  output?: OutputWriter;
  backupEngine?: BackupService;
  workspaceEngine?: WorkspaceService;
}

export class ProtectCommand {
  private readonly projectPath: string;
  private readonly output: OutputWriter;
  private readonly backupEngine: BackupService;
  private readonly workspaceEngine: WorkspaceService;

  constructor(options: ProtectCommandOptions) {
    this.projectPath = resolve(options.projectPath);
    this.output = options.output ?? new ConsoleOutputWriter();
    this.backupEngine =
      options.backupEngine ??
      new BackupEngine({ output: new NullOutputWriter() });
    this.workspaceEngine = options.workspaceEngine ?? new WorkspaceEngine();
  }

  async execute(): Promise<WorkspaceResult> {
    await this.backupEngine.create(this.projectPath);
    const workspaceResult = await this.workspaceEngine.create(this.projectPath);

    this.printSummary(workspaceResult);

    return workspaceResult;
  }

  private printSummary(workspaceResult: WorkspaceResult): void {
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
  }
}
