import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { DeployService } from '../../deploy/index.js';
import type { OutputWriter } from '../../utils/index.js';
import { ConsoleOutputWriter } from '../../utils/index.js';
import { resolveWorkspacePath } from '../../utils/workspace-path.js';

export interface DeployCommandOptions {
  workspacePath: string;
  production?: boolean;
  skipFirestore?: boolean;
  skipNetlify?: boolean;
  dryRun?: boolean;
  importEnv?: boolean;
  output?: OutputWriter;
  deployService?: DeployService;
}

/**
 * Despliega reglas Firestore y el sitio Netlify desde un workspace Funimas.
 */
export class DeployCommand {
  private readonly options: DeployCommandOptions;
  private readonly output: OutputWriter;
  private readonly deployService: DeployService;

  constructor(options: DeployCommandOptions) {
    this.options = options;
    this.output = options.output ?? new ConsoleOutputWriter();
    this.deployService = options.deployService ?? new DeployService();
  }

  async execute(): Promise<number> {
    const workspacePath = resolve(this.options.workspacePath);

    try {
      await access(workspacePath);
    } catch {
      this.output.writeln(`Error: el workspace no existe: ${workspacePath}`);
      this.output.writeln();
      this.output.writeln('Ejecuta primero: funimas protect <ruta-del-proyecto>');
      return 1;
    }

    this.output.writeln('Funimas — Despliegue');
    this.output.writeln();
    this.output.writeln(`Workspace: ${workspacePath}`);
    this.output.writeln();

    const result = await this.deployService.deploy({
      workspacePath,
      production: this.options.production,
      skipFirestore: this.options.skipFirestore,
      skipNetlify: this.options.skipNetlify,
      dryRun: this.options.dryRun,
      importEnv: this.options.importEnv,
    });

    for (const step of result.steps) {
      const status = step.success ? '✔' : '✗';
      this.output.writeln(`${status} ${step.step}`);
      this.output.writeln(`  ${step.command}`);

      if (step.output) {
        this.output.writeln();
        this.output.writeln(step.output);
      }

      if (step.error) {
        this.output.writeln();
        this.output.writeln(`Error: ${step.error}`);
      }

      this.output.writeln();
    }

    if (result.success) {
      this.output.writeln('Despliegue completado.');
      return 0;
    }

    this.output.writeln('Despliegue fallido. Revisa los errores anteriores.');
    return 1;
  }
}

export { resolveWorkspacePath };
