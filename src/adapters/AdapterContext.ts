import type { PlannerResult } from '../planner/PlannerResult.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';

export interface AdapterContextData {
  projectPath: string;
  workspacePath?: string;
  semanticResult?: SemanticResult;
  plannerResult?: PlannerResult;
}

/**
 * Contexto compartido entre el compilador y los adaptadores de plataforma.
 */
export class AdapterContext {
  readonly projectPath: string;
  readonly workspacePath?: string;
  readonly semanticResult?: SemanticResult;
  readonly plannerResult?: PlannerResult;

  constructor(data: AdapterContextData) {
    this.projectPath = data.projectPath;
    this.workspacePath = data.workspacePath;
    this.semanticResult = data.semanticResult;
    this.plannerResult = data.plannerResult;
  }

  getTargetPath(): string {
    return this.workspacePath ?? this.projectPath;
  }
}
