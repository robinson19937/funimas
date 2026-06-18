import type { SemanticOperation } from '../semantic/SemanticOperation.js';
import type { RewriteApplication } from './RewriteApplication.js';
import type { RewriteContext } from './RewriteContext.js';

export interface RewriteRule {
  readonly id: string;
  readonly name: string;
  canApply(operation: SemanticOperation): boolean;
  apply(context: RewriteContext, operation: SemanticOperation): Promise<RewriteApplication | null>;
}
