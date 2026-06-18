import type { SemanticContext } from './SemanticContext.js';
import type { SemanticOperation } from './SemanticOperation.js';

export interface SemanticRule {
  readonly id: string;
  readonly name: string;
  analyze(context: SemanticContext): SemanticOperation[] | Promise<SemanticOperation[]>;
}
