import { AdapterContext } from '../adapters/AdapterContext.js';
import type { PlatformAdapter } from '../adapters/PlatformAdapter.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';

import type { GeneratorContext } from './GeneratorContext.js';
import { GeneratorResult } from './GeneratorResult.js';
import { GeneratorFileWriter } from './GeneratorFileWriter.js';

export interface FunctionGeneratorOptions {
  fileWriter?: GeneratorFileWriter;
  now?: () => Date;
}

export interface FunctionGeneratorService {
  generate(
    context: GeneratorContext,
    operation: SemanticOperation,
    adapter: PlatformAdapter,
  ): Promise<GeneratorResult>;
}

/**
 * Genera funciones delegando en el adaptador de plataforma seleccionado.
 */
export class FunctionGenerator implements FunctionGeneratorService {
  private readonly fileWriter: GeneratorFileWriter;
  private readonly now: () => Date;

  constructor(options: FunctionGeneratorOptions = {}) {
    this.fileWriter = options.fileWriter ?? new GeneratorFileWriter();
    this.now = options.now ?? (() => new Date());
  }

  async generate(
    context: GeneratorContext,
    operation: SemanticOperation,
    adapter: PlatformAdapter,
  ): Promise<GeneratorResult> {
    const startedAt = this.now();
    const adapterContext = new AdapterContext({
      projectPath: context.projectPath,
      workspacePath: context.workspacePath,
      semanticResult: context.semanticResult,
      operation,
    });
    const adapterResult = await adapter.generateFunction(adapterContext);

    if (!adapterResult.success || adapterResult.data.files.length === 0) {
      const finishedAt = this.now();

      return new GeneratorResult({
        files: [],
        runtimeGenerated: false,
        sdkGenerated: false,
        functionFileNames: [],
        startedAt,
        finishedAt,
      });
    }

    const written = await this.fileWriter.writeFiles(
      context.workspacePath,
      adapterResult.data.files,
    );
    const finishedAt = this.now();

    return new GeneratorResult({
      files: written,
      runtimeGenerated: false,
      sdkGenerated: false,
      functionFileNames: adapterResult.data.functions,
      startedAt,
      finishedAt,
    });
  }
}
