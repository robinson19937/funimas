import { access } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { WorkspaceVerifier } from '../../verify/index.js';
import type { OutputWriter } from '../../utils/index.js';
import { ConsoleOutputWriter } from '../../utils/index.js';
import { resolveWorkspacePath } from '../../utils/workspace-path.js';

export interface VerifyCommandOptions {
  workspacePath: string;
  skipBuild?: boolean;
  skipDeployReadiness?: boolean;
  output?: OutputWriter;
  workspaceVerifier?: WorkspaceVerifier;
}

export class VerifyCommand {
  private readonly options: VerifyCommandOptions;
  private readonly output: OutputWriter;
  private readonly workspaceVerifier: WorkspaceVerifier;

  constructor(options: VerifyCommandOptions) {
    this.options = options;
    this.output = options.output ?? new ConsoleOutputWriter();
    this.workspaceVerifier = options.workspaceVerifier ?? new WorkspaceVerifier();
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

    this.output.writeln('Funimas — Verificación funcional');
    this.output.writeln();
    this.output.writeln(`Workspace: ${workspacePath}`);
    this.output.writeln();

    const report = await this.workspaceVerifier.verify(workspacePath, {
      skipBuild: this.options.skipBuild,
      skipDeployReadiness: this.options.skipDeployReadiness,
      requireEnv: true,
    });

    for (const check of report.checks) {
      const icon = check.passed ? '✔' : check.level === 'error' ? '✗' : '⚠';
      this.output.writeln(`${icon} ${check.name}: ${check.message}`);
      this.output.writeln();
    }

    if (report.untransformedOperations.length > 0) {
      this.output.writeln('Operaciones sin transformar:');
      this.output.writeln();

      for (const finding of report.untransformedOperations) {
        const callee = finding.callee ? `${finding.callee}()` : finding.operationType;
        this.output.writeln(
          `- ${finding.file}:${finding.line} — ${callee} (${finding.reason})`,
        );
        this.output.writeln(`  ${finding.recommendation}`);
        this.output.writeln();
      }
    }

    await this.writeVerifyReport(workspacePath, report);

    if (report.ready) {
      this.output.writeln('Workspace funcional y listo para desplegar.');
      this.output.writeln();
      this.output.writeln('Siguiente paso:');
      this.output.writeln(`  funimas deploy ${workspacePath} --import-env --prod`);
      this.output.writeln();
      return 0;
    }

    this.output.writeln(
      'El workspace no pasó la verificación funcional. Revisa los errores anteriores.',
    );
    return 1;
  }

  private async writeVerifyReport(
    workspacePath: string,
    report: Awaited<ReturnType<WorkspaceVerifier['verify']>>,
  ): Promise<void> {
    const reportDir = join(workspacePath, '.funimas', 'reports');
    await mkdir(reportDir, { recursive: true });

    const verifyJson = {
      ready: report.ready,
      workspacePath: report.workspacePath,
      durationMs: report.durationMs,
      finishedAt: report.finishedAt.toISOString(),
      checks: report.checks,
      untransformedOperations: report.untransformedOperations,
    };

    await writeFile(join(reportDir, 'verify.json'), `${JSON.stringify(verifyJson, null, 2)}\n`, 'utf8');
    this.output.writeln('✔ verify.json');
    this.output.writeln();
  }
}

export { resolveWorkspacePath };
