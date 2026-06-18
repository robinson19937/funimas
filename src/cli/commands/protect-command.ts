import { resolve } from 'node:path';

import { ConsoleOutputWriter, type OutputWriter, VERSION } from '../../utils/index.js';

export interface ProtectCommandOptions {
  projectPath: string;
  output?: OutputWriter;
}

export class ProtectCommand {
  private readonly projectPath: string;
  private readonly output: OutputWriter;

  constructor(options: ProtectCommandOptions) {
    this.projectPath = resolve(options.projectPath);
    this.output = options.output ?? new ConsoleOutputWriter();
  }

  async execute(): Promise<void> {
    this.output.writeln(`Funimas v${VERSION}`);
    this.output.writeln();
    this.output.writeln('Proyecto:');
    this.output.writeln(this.projectPath);
    this.output.writeln();
    this.output.writeln('Inicializando...');
  }
}
