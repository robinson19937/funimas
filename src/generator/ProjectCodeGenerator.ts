import { PlannerContext } from '../planner/PlannerContext.js';
import type { PlatformAdapter } from '../adapters/PlatformAdapter.js';

import type { GeneratorContext } from './GeneratorContext.js';
import { FunctionGenerator } from './FunctionGenerator.js';
import { GeneratorResult } from './GeneratorResult.js';
import { RuntimeGenerator } from './RuntimeGenerator.js';
import { SDKGenerator } from './SDKGenerator.js';
import { isSupportedFunctionOperation } from './operation-utils.js';

export interface ProjectCodeGeneratorOptions {
  runtimeGenerator?: RuntimeGenerator;
  sdkGenerator?: SDKGenerator;
  functionGenerator?: FunctionGenerator;
}

export interface ProjectCodeGeneratorService {
  generate(context: GeneratorContext, adapter: PlatformAdapter): Promise<GeneratorResult>;
}

/**
 * Orquesta la generación de runtime, SDK y functions dentro del workspace.
 */
export class ProjectCodeGenerator implements ProjectCodeGeneratorService {
  private readonly runtimeGenerator: RuntimeGenerator;
  private readonly sdkGenerator: SDKGenerator;
  private readonly functionGenerator: FunctionGenerator;

  constructor(options: ProjectCodeGeneratorOptions = {}) {
    this.runtimeGenerator = options.runtimeGenerator ?? new RuntimeGenerator();
    this.sdkGenerator = options.sdkGenerator ?? new SDKGenerator();
    this.functionGenerator = options.functionGenerator ?? new FunctionGenerator();
  }

  async generate(context: GeneratorContext, adapter: PlatformAdapter): Promise<GeneratorResult> {
    const runtimeResult = await this.runtimeGenerator.generate(context);
    const sdkResult = await this.sdkGenerator.generate(context);
    const functionResults: GeneratorResult[] = [];
    const plannerContext = new PlannerContext(context.semanticResult);
    const processedOperationTypes = new Set<string>();

    for (const operation of plannerContext.getTransformableOperations()) {
      if (!isSupportedFunctionOperation(operation.type)) {
        continue;
      }

      if (processedOperationTypes.has(operation.type)) {
        continue;
      }

      processedOperationTypes.add(operation.type);
      const functionResult = await this.functionGenerator.generate(context, operation, adapter);
      functionResults.push(functionResult);
    }

    return GeneratorResult.merge([runtimeResult, sdkResult, ...functionResults]);
  }
}
