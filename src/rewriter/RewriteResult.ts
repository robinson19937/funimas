import type { SemanticOperationType } from '../semantic/SemanticOperationType.js';
import { SEMANTIC_OPERATION_TYPES } from '../semantic/SemanticOperationType.js';

export interface RewriteResultData {
  modifiedFiles: string[];
  operationsRewritten: Record<SemanticOperationType, number>;
  importsAdded: string[];
  importsRemoved: string[];
  startedAt: Date;
  finishedAt: Date;
}

export function createEmptyOperationsRewritten(): Record<SemanticOperationType, number> {
  return SEMANTIC_OPERATION_TYPES.reduce(
    (counts, type) => {
      counts[type] = 0;
      return counts;
    },
    {} as Record<SemanticOperationType, number>,
  );
}

export class RewriteResult {
  readonly modifiedFiles: string[];
  readonly operationsRewritten: Record<SemanticOperationType, number>;
  readonly importsAdded: string[];
  readonly importsRemoved: string[];
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: RewriteResultData) {
    this.modifiedFiles = data.modifiedFiles;
    this.operationsRewritten = data.operationsRewritten;
    this.importsAdded = data.importsAdded;
    this.importsRemoved = data.importsRemoved;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }

  get totalOperationsRewritten(): number {
    return Object.values(this.operationsRewritten).reduce((total, count) => total + count, 0);
  }
}
