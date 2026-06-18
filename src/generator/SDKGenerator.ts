import type { GeneratedFile } from '../adapters/GeneratedFile.js';

import type { GeneratorContext } from './GeneratorContext.js';
import { GeneratorResult } from './GeneratorResult.js';
import { GeneratorFileWriter } from './GeneratorFileWriter.js';
import { renderDatabaseClient } from './templates/sdk/database/DatabaseClient.js';
import { renderSdkIndex } from './templates/sdk/index.js';

export interface SDKGeneratorOptions {
  fileWriter?: GeneratorFileWriter;
  now?: () => Date;
}

export interface SDKGeneratorService {
  generate(context: GeneratorContext): Promise<GeneratorResult>;
}

/**
 * Genera el SDK mínimo dentro del workspace.
 */
export class SDKGenerator implements SDKGeneratorService {
  private readonly fileWriter: GeneratorFileWriter;
  private readonly now: () => Date;

  constructor(options: SDKGeneratorOptions = {}) {
    this.fileWriter = options.fileWriter ?? new GeneratorFileWriter({ generatorName: 'SDKGenerator' });
    this.now = options.now ?? (() => new Date());
  }

  async generate(context: GeneratorContext): Promise<GeneratorResult> {
    const startedAt = this.now();
    const files: GeneratedFile[] = [
      {
        fileName: 'index.ts',
        relativePath: 'sdk/index.ts',
        content: renderSdkIndex(),
      },
      {
        fileName: 'DatabaseClient.ts',
        relativePath: 'sdk/database/DatabaseClient.ts',
        content: renderDatabaseClient(),
      },
    ];
    const written = await this.fileWriter.writeFiles(context.workspacePath, files);
    const finishedAt = this.now();

    return new GeneratorResult({
      files: written,
      runtimeGenerated: false,
      sdkGenerated: true,
      functionFileNames: [],
      startedAt,
      finishedAt,
    });
  }
}
