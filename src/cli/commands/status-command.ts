import { resolve } from 'node:path';

import { ProjectStatusAnalyzer } from '../../status/index.js';
import type { OutputWriter } from '../../utils/index.js';
import { ConsoleOutputWriter } from '../../utils/index.js';
import { WorkspaceError } from '../../workspace/WorkspaceUtils.js';

export interface StatusCommandOptions {
  projectPath: string;
  output?: OutputWriter;
  analyzer?: ProjectStatusAnalyzer;
}

/**
 * Analiza un proyecto sin migrarlo y reporta APIs listas vs pendientes para producción.
 */
export class StatusCommand {
  private readonly options: StatusCommandOptions;
  private readonly output: OutputWriter;
  private readonly analyzer: ProjectStatusAnalyzer;

  constructor(options: StatusCommandOptions) {
    this.options = options;
    this.output = options.output ?? new ConsoleOutputWriter();
    this.analyzer = options.analyzer ?? new ProjectStatusAnalyzer();
  }

  async execute(): Promise<number> {
    const projectPath = resolve(this.options.projectPath);

    try {
      const report = await this.analyzer.analyze(projectPath);

      this.output.writeln('Funimas — Estado del proyecto');
      this.output.writeln();
      this.output.writeln(`Proyecto: ${report.projectPath}`);

      if (report.isWorkspace) {
        this.output.writeln('Tipo: workspace protegido (_funimas)');
      } else {
        this.output.writeln('Tipo: proyecto original (sin migrar)');
      }

      this.output.writeln();
      this.output.writeln('Firestore — APIs soportadas (reescritura automática)');
      this.output.writeln();

      const supportedEntries = Object.entries(report.firestoreSupported);

      if (supportedEntries.length === 0) {
        this.output.writeln('  (ninguna detectada)');
      } else {
        for (const [callee, count] of supportedEntries.sort(([a], [b]) => a.localeCompare(b))) {
          this.output.writeln(`  ✔ ${callee}(): ${count}`);
        }
      }

      this.output.writeln();
      this.output.writeln('Firestore — APIs no soportadas (migración manual)');
      this.output.writeln();

      if (report.unsupportedFindings.length === 0) {
        this.output.writeln('  (ninguna detectada)');
      } else {
        for (const finding of report.unsupportedFindings) {
          this.output.writeln(`  ✗ ${finding.callee}() — ${finding.file}:${finding.line}`);
          this.output.writeln(`    → ${finding.recommendation}`);
        }
      }

      if (report.authOperations > 0) {
        this.output.writeln();
        this.output.writeln(`Firebase Auth: ${report.authOperations} operación(es) (se mantiene en cliente)`);
      }

      if (report.storageOperations > 0) {
        this.output.writeln();
        this.output.writeln(
          `Firebase Storage: ${report.storageOperations} operación(es) sin transformación automática`,
        );
      }

      this.output.writeln();
      this.output.writeln('═══════════════════════════════════════');

      if (report.productionReady) {
        this.output.writeln('Listo para proteger con Funimas');
        this.output.writeln();
        this.output.writeln('Siguiente paso:');
        this.output.writeln(`  funimas protect ${projectPath}`);
        return 0;
      }

      this.output.writeln('No listo para producción automática');
      this.output.writeln();

      for (const blocker of report.blockers) {
        this.output.writeln(`  • ${blocker}`);
      }

      this.output.writeln();
      this.output.writeln('Corrige los bloqueos antes de desplegar con reglas estrictas.');
      return 1;
    } catch (error) {
      if (error instanceof WorkspaceError) {
        this.output.writeln(`Error: ${error.message}`);
        return 1;
      }

      throw error;
    }
  }
}
