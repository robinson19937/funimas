import { ProtectCommand } from './commands/protect-command.js';
import { ProjectFsError, ProjectValidator } from '../pipeline/ProjectValidator.js';

export interface CliOptions {
  argv?: string[];
}

export class CliApp {
  private readonly argv: string[];

  constructor(options: CliOptions = {}) {
    this.argv = options.argv ?? process.argv;
  }

  async run(): Promise<number> {
    const args = this.argv.slice(2);

    if (args.length === 0) {
      this.printUsage();
      return 1;
    }

    const [command, ...rest] = args;

    switch (command) {
      case 'protect':
        return this.runProtect(rest);
      default:
        console.error(`Comando desconocido: ${command}`);
        this.printUsage();
        return 1;
    }
  }

  private async runProtect(args: string[]): Promise<number> {
    const projectPath = args[0];

    if (!projectPath) {
      console.error('Error: debes indicar la ruta del proyecto.');
      console.error('Uso: funimas protect <ruta-del-proyecto>');
      return 1;
    }

    try {
      const validator = new ProjectValidator();
      const validation = await validator.validate(projectPath);
      const command = new ProtectCommand({ projectPath: validation.projectPath });

      await command.executePipeline();

      return 0;
    } catch (error) {
      if (error instanceof ProjectFsError) {
        console.error(`Error: ${error.message}`);
        return 1;
      }

      throw error;
    }
  }

  private printUsage(): void {
    console.log('Uso: funimas <comando> [opciones]');
    console.log();
    console.log('Comandos:');
    console.log('  protect <ruta-del-proyecto>  Inicializa la protección de un proyecto');
  }
}
