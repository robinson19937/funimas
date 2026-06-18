import { AdapterContext } from '../adapters/AdapterContext.js';
import type { PlatformAdapter } from '../adapters/PlatformAdapter.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';

import type { GeneratorContext } from './GeneratorContext.js';
import { GeneratorResult } from './GeneratorResult.js';
import { GeneratorFileWriter } from './GeneratorFileWriter.js';
import { DatabaseInsertFunctionGenerator } from './functions/DatabaseInsertFunctionGenerator.js';

export interface FunctionGeneratorOptions {
  fileWriter?: GeneratorFileWriter;
  databaseInsertGenerator?: DatabaseInsertFunctionGenerator;
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
 * Genera funciones delegando en generadores especializados o el adaptador de plataforma.
 */
export class FunctionGenerator implements FunctionGeneratorService {
  private readonly fileWriter: GeneratorFileWriter;
  private readonly databaseInsertGenerator: DatabaseInsertFunctionGenerator;
  private readonly now: () => Date;

  constructor(options: FunctionGeneratorOptions = {}) {
    this.fileWriter = options.fileWriter ?? new GeneratorFileWriter();
    this.databaseInsertGenerator =
      options.databaseInsertGenerator ?? new DatabaseInsertFunctionGenerator({
        fileWriter: this.fileWriter,
      });
    this.now = options.now ?? (() => new Date());
  }

  async generate(
    context: GeneratorContext,
    operation: SemanticOperation,
    adapter: PlatformAdapter,
  ): Promise<GeneratorResult> {
    const startedAt = this.now();

    const specializedResult = await this.databaseInsertGenerator.generate(
      context,
      operation,
      adapter,
    );

    if (specializedResult) {
      const finishedAt = this.now();

      return new GeneratorResult({
        files: [specializedResult.file],
        runtimeGenerated: false,
        sdkGenerated: false,
        functionFileNames: [specializedResult.file.fileName],
        startedAt,
        finishedAt,
      });
    }

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
