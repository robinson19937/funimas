import { resolve } from 'node:path';

import { ConsoleOutputWriter, type OutputWriter } from '../utils/output.js';

import { BackupResult } from './BackupResult.js';
import {
  assertProjectDirectoryExists,
  copyProjectContents,
  ensureDirectory,
  formatBackupTimestamp,
  getRelativeBackupPath,
} from './BackupUtils.js';

export interface BackupService {
  create(projectPath: string): Promise<BackupResult>;
}

export interface BackupEngineOptions {
  output?: OutputWriter;
  now?: () => Date;
}

export class BackupEngine implements BackupService {
  private readonly output: OutputWriter;
  private readonly now: () => Date;

  constructor(options: BackupEngineOptions = {}) {
    this.output = options.output ?? new ConsoleOutputWriter();
    this.now = options.now ?? (() => new Date());
  }

  async create(projectPath: string): Promise<BackupResult> {
    const resolvedProjectPath = resolve(projectPath);
    const startedAt = this.now();

    await assertProjectDirectoryExists(resolvedProjectPath);

    const timestamp = formatBackupTimestamp(startedAt);
    const relativeBackupPath = getRelativeBackupPath(timestamp);
    const backupsDir = resolve(resolvedProjectPath, '.funimas', 'backups');
    const backupPath = resolve(backupsDir, timestamp);

    this.output.writeln('Creando backup...');
    this.output.writeln();

    await ensureDirectory(backupsDir);
    const filesCopied = await copyProjectContents(resolvedProjectPath, backupPath);

    const finishedAt = this.now();
    const result = new BackupResult({
      backupPath,
      relativeBackupPath,
      filesCopied,
      startedAt,
      finishedAt,
    });

    this.printSummary(result);

    return result;
  }

  private printSummary(result: BackupResult): void {
    this.output.writeln('✔ Backup completado');
    this.output.writeln();
    this.output.writeln(`Archivos copiados: ${result.filesCopied}`);
    this.output.writeln();
    this.output.writeln('Destino:');
    this.output.writeln();
    this.output.writeln(result.relativeBackupPath);
  }
}
