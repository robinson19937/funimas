import type { SemanticResult } from '../semantic/SemanticResult.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';

export class PlannerContext {
  readonly semanticResult: SemanticResult;

  constructor(semanticResult: SemanticResult) {
    this.semanticResult = semanticResult;
  }

  getTransformableOperations(): SemanticOperation[] {
    return this.semanticResult.operations.filter((operation) => {
      if (operation.type === 'CUSTOM' && operation.metadata.category === 'import') {
        return false;
      }

      return operation.type !== 'CUSTOM';
    });
  }

  getProvider(): string | undefined {
    const provider = this.semanticResult.operations.find(
      (operation) => typeof operation.metadata.provider === 'string',
    )?.metadata.provider;

    return typeof provider === 'string' ? provider : undefined;
  }
}
