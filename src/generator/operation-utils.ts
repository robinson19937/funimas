import type { SemanticOperationType } from '../semantic/SemanticOperationType.js';
import { operationTypeToFileName } from '../utils/operation-naming.js';

export { operationTypeToFileName };

export function getSupportedFunctionOperationTypes(): SemanticOperationType[] {
  return ['DATABASE_INSERT'];
}

export function isSupportedFunctionOperation(operationType: SemanticOperationType): boolean {
  return getSupportedFunctionOperationTypes().includes(operationType);
}
