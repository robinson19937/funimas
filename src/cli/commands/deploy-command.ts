import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { DeployReadinessChecker, DeployService } from '../../deploy/index.js';
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
  check?: boolean;
  output?: OutputWriter;
  deployService?: DeployService;
  readinessChecker?: DeployReadinessChecker;
}

/**
 * Despliega reglas Firebase y el sitio Netlify desde un workspace Funimas.
 */
export class DeployCommand {
  private readonly options: DeployCommandOptions;
  private readonly output: OutputWriter;
  private readonly deployService: DeployService;
  private readonly readinessChecker: DeployReadinessChecker;

  constructor(options: DeployCommandOptions) {
    this.options = options;
    this.output = options.output ?? new ConsoleOutputWriter();
    this.deployService = options.deployService ?? new DeployService();
    this.readinessChecker = options.readinessChecker ?? new DeployReadinessChecker();
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

    if (this.options.check) {
      return this.executeCheck(workspacePath);
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

  private async executeCheck(workspacePath: string): Promise<number> {
    this.output.writeln('Funimas — Verificación pre-deploy');
    this.output.writeln();
    this.output.writeln(`Workspace: ${workspacePath}`);
    this.output.writeln();

    const report = await this.readinessChecker.check(workspacePath);

    for (const check of report.checks) {
      const icon = check.passed ? '✔' : check.level === 'error' ? '✗' : '⚠';
      this.output.writeln(`${icon} ${check.name}: ${check.message}`);
      this.output.writeln();
    }

    if (report.ready) {
      this.output.writeln('Workspace listo para desplegar.');
      this.output.writeln();
      this.output.writeln('Siguiente paso:');
      this.output.writeln(`  funimas deploy ${workspacePath} --import-env --prod`);
      this.output.writeln();
      return 0;
    }

    this.output.writeln('El workspace no está listo. Corrige los errores antes de desplegar.');
    return 1;
  }
}

export { resolveWorkspacePath };
