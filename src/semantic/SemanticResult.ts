import type { SemanticOperation } from './SemanticOperation.js';
import type { SemanticOperationType } from './SemanticOperationType.js';
import type { DomainMutation } from '../domain/DomainMutation.js';

export interface SemanticResultData {
  operations: SemanticOperation[];
  totalOperations: number;
  operationsByType: Record<SemanticOperationType, number>;
  startedAt: Date;
  finishedAt: Date;
  domainMutations?: DomainMutation[];
}

export class SemanticResult {
  readonly operations: SemanticOperation[];
  readonly totalOperations: number;
  readonly operationsByType: Record<SemanticOperationType, number>;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly domainMutations: DomainMutation[];

  constructor(data: SemanticResultData) {
    this.operations = data.operations;
    this.totalOperations = data.totalOperations;
    this.operationsByType = data.operationsByType;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
    this.domainMutations = data.domainMutations ?? [];
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }

  getOperationsByType(type: SemanticOperationType): SemanticOperation[] {
    return this.operations.filter((operation) => operation.type === type);
  }

  getOperationsByMetadata(key: string, value: unknown): SemanticOperation[] {
    return this.operations.filter((operation) => operation.metadata[key] === value);
  }

  hasProvider(provider: string): boolean {
    return this.operations.some((operation) => operation.metadata.provider === provider);
  }
}
