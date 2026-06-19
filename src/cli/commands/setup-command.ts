import { PrerequisiteChecker } from '../../deploy/index.js';
import type { OutputWriter } from '../../utils/index.js';
import { ConsoleOutputWriter } from '../../utils/index.js';

export interface SetupCommandOptions {
  output?: OutputWriter;
}

/**
 * Verifica prerequisitos del entorno (Node, Git, Firebase CLI, Netlify CLI).
 */
export class SetupCommand {
  private readonly checker: PrerequisiteChecker;
  private readonly output: OutputWriter;

  constructor(options: SetupCommandOptions = {}) {
    this.checker = new PrerequisiteChecker();
    this.output = options.output ?? new ConsoleOutputWriter();
  }

  async execute(): Promise<number> {
    this.output.writeln('Funimas — Verificación de prerequisitos');
    this.output.writeln();

    const report = await this.checker.check();

    for (const check of report.checks) {
      if (check.available) {
        this.output.writeln(`✔ ${check.name}${check.version ? ` (${check.version})` : ''}`);
      } else {
        this.output.writeln(`✗ ${check.name}`);
        this.output.writeln(`  ${check.installHint}`);
      }

      this.output.writeln();
    }

    if (!report.allRequiredMet) {
      this.output.writeln('Faltan prerequisitos obligatorios.');
      return 1;
    }

    this.output.writeln('Prerequisitos obligatorios listos.');
    this.output.writeln();
    this.output.writeln('Siguiente paso:');
    this.output.writeln('  funimas protect ./ruta-de-tu-proyecto');
    this.output.writeln();

    return 0;
  }
}
