import type { GeneratedFile } from '../adapters/GeneratedFile.js';

import type { GeneratorContext } from './GeneratorContext.js';
import { GeneratorResult } from './GeneratorResult.js';
import { GeneratorFileWriter } from './GeneratorFileWriter.js';
import { renderRuntimeIndex } from './templates/runtime/index.js';

export interface RuntimeGeneratorOptions {
  fileWriter?: GeneratorFileWriter;
  now?: () => Date;
}

export interface RuntimeGeneratorService {
  generate(context: GeneratorContext): Promise<GeneratorResult>;
}

/**
 * Genera el runtime mínimo dentro del workspace.
 */
export class RuntimeGenerator implements RuntimeGeneratorService {
  private readonly fileWriter: GeneratorFileWriter;
  private readonly now: () => Date;

  constructor(options: RuntimeGeneratorOptions = {}) {
    this.fileWriter = options.fileWriter ?? new GeneratorFileWriter();
    this.now = options.now ?? (() => new Date());
  }

  async generate(context: GeneratorContext): Promise<GeneratorResult> {
    const startedAt = this.now();
    const file: GeneratedFile = {
      fileName: 'index.ts',
      relativePath: 'runtime/index.ts',
      content: renderRuntimeIndex(),
    };
    const written = await this.fileWriter.writeFile(context.workspacePath, file);
    const finishedAt = this.now();

    return new GeneratorResult({
      files: [written],
      runtimeGenerated: true,
      sdkGenerated: false,
      functionFileNames: [],
      startedAt,
      finishedAt,
    });
  }
}
