import { resolve } from 'node:path';

import { BackupEngine, type BackupService } from '../../backup/index.js';
import { ConsoleOutputWriter, type OutputWriter, VERSION } from '../../utils/index.js';

export interface ProtectCommandOptions {
  projectPath: string;
  output?: OutputWriter;
  backupEngine?: BackupService;
}

export class ProtectCommand {
  private readonly projectPath: string;
  private readonly output: OutputWriter;
  private readonly backupEngine: BackupService;

  constructor(options: ProtectCommandOptions) {
    this.projectPath = resolve(options.projectPath);
    this.output = options.output ?? new ConsoleOutputWriter();
    this.backupEngine = options.backupEngine ?? new BackupEngine({ output: this.output });
  }

  async execute(): Promise<void> {
    this.output.writeln(`Funimas v${VERSION}`);
    this.output.writeln();
    this.output.writeln('Proyecto:');
    this.output.writeln(this.projectPath);
    this.output.writeln();
    this.output.writeln('Inicializando...');
    this.output.writeln();

    await this.backupEngine.create(this.projectPath);
  }
}
