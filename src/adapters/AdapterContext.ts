import type { PlannerResult } from '../planner/PlannerResult.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';

export interface AdapterContextData {
  projectPath: string;
  workspacePath?: string;
  semanticResult?: SemanticResult;
  plannerResult?: PlannerResult;
  operation?: SemanticOperation;
}

/**
 * Contexto compartido entre el compilador y los adaptadores de plataforma.
 */
export class AdapterContext {
  readonly projectPath: string;
  readonly workspacePath?: string;
  readonly semanticResult?: SemanticResult;
  readonly plannerResult?: PlannerResult;
  readonly operation?: SemanticOperation;

  constructor(data: AdapterContextData) {
    this.projectPath = data.projectPath;
    this.workspacePath = data.workspacePath;
    this.semanticResult = data.semanticResult;
    this.plannerResult = data.plannerResult;
    this.operation = data.operation;
  }

  getTargetPath(): string {
    return this.workspacePath ?? this.projectPath;
  }
}
