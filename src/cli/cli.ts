import { ProtectCommand } from './commands/protect-command.js';
import { DeployCommand, resolveWorkspacePath } from './commands/deploy-command.js';
import { SetupCommand } from './commands/setup-command.js';
import { ProjectFsError, ProjectValidator } from '../pipeline/ProjectValidator.js';

export interface CliOptions {
  argv?: string[];
}

interface ParsedFlags {
  production: boolean;
  skipFirestore: boolean;
  skipNetlify: boolean;
  dryRun: boolean;
  importEnv: boolean;
  check: boolean;
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
      case 'setup':
        return this.runSetup();
      case 'deploy':
        return this.runDeploy(rest);
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

  private async runSetup(): Promise<number> {
    const command = new SetupCommand();
    return command.execute();
  }

  private async runDeploy(args: string[]): Promise<number> {
    const { positional, flags } = this.parseDeployArgs(args);
    const workspacePath = resolveWorkspacePath(positional[0] ?? process.cwd());

    const command = new DeployCommand({
      workspacePath,
      production: flags.production,
      skipFirestore: flags.skipFirestore,
      skipNetlify: flags.skipNetlify,
      dryRun: flags.dryRun,
      importEnv: flags.importEnv,
      check: flags.check,
    });

    return command.execute();
  }

  private parseDeployArgs(args: string[]): { positional: string[]; flags: ParsedFlags } {
    const positional: string[] = [];
    const flags: ParsedFlags = {
      production: false,
      skipFirestore: false,
      skipNetlify: false,
      dryRun: false,
      importEnv: false,
      check: false,
    };

    for (const arg of args) {
      switch (arg) {
        case '--prod':
        case '--production':
          flags.production = true;
          break;
        case '--skip-firestore':
          flags.skipFirestore = true;
          break;
        case '--skip-netlify':
          flags.skipNetlify = true;
          break;
        case '--dry-run':
          flags.dryRun = true;
          break;
        case '--import-env':
          flags.importEnv = true;
          break;
        case '--check':
          flags.check = true;
          break;
        default:
          if (!arg.startsWith('-')) {
            positional.push(arg);
          }
          break;
      }
    }

    return { positional, flags };
  }

  private printUsage(): void {
    console.log('Uso: funimas <comando> [opciones]');
    console.log();
    console.log('Comandos:');
    console.log('  setup                        Verifica prerequisitos (Node, Git, Firebase, Netlify)');
    console.log('  protect <ruta-del-proyecto>    Protege un proyecto y genera el workspace');
    console.log('  deploy [workspace] [opciones]  Despliega reglas Firestore y sitio Netlify');
    console.log();
    console.log('Opciones de deploy:');
    console.log('  --prod              Despliegue a producción en Netlify');
    console.log('  --import-env        Importa variables desde .env a Netlify');
    console.log('  --skip-firestore    Omite firebase deploy --only firestore:rules');
    console.log('  --skip-netlify      Omite netlify deploy');
    console.log('  --dry-run           Muestra comandos sin ejecutarlos');
    console.log('  --check             Valida workspace y .env sin desplegar');
  }
}
