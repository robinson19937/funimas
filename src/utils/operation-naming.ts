import type { SemanticOperationType } from '../semantic/SemanticOperationType.js';

export function operationTypeToFileName(operationType: SemanticOperationType): string {
  return operationType.toLowerCase();
}
