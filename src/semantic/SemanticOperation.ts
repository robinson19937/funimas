import { randomUUID } from 'node:crypto';

import type { SemanticOperationType } from './SemanticOperationType.js';

export interface SemanticOperationData {
  id?: string;
  type: SemanticOperationType;
  file: string;
  line: number;
  column: number;
  description: string;
  metadata?: Record<string, unknown>;
}

export class SemanticOperation {
  readonly id: string;
  readonly type: SemanticOperationType;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly description: string;
  readonly metadata: Record<string, unknown>;

  constructor(data: SemanticOperationData) {
    this.id = data.id ?? randomUUID();
    this.type = data.type;
    this.file = data.file;
    this.line = data.line;
    this.column = data.column;
    this.description = data.description;
    this.metadata = data.metadata ?? {};
  }
}
