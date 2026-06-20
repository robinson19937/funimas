import { PlannerContext } from '../planner/PlannerContext.js';
import type { PlannerResult } from '../planner/PlannerResult.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';
import type { TransformationHistory } from '../history/TransformationHistory.js';
import type { Project } from 'ts-morph';

export interface RewriteContextData {
  projectPath: string;
  workspacePath: string;
  semanticResult: SemanticResult;
  plannerResult?: PlannerResult;
  morphProject?: Project;
  history?: TransformationHistory;
  excludedOperationKeys?: Set<string>;
}

/**
 * Contexto de reescritura limitado al workspace de trabajo.
 */
export class RewriteContext {
  readonly projectPath: string;
  readonly workspacePath: string;
  readonly semanticResult: SemanticResult;
  readonly plannerResult?: PlannerResult;
  readonly history?: TransformationHistory;
  readonly excludedOperationKeys: Set<string>;
  private morphProject?: Project;

  constructor(data: RewriteContextData) {
    this.projectPath = data.projectPath;
    this.workspacePath = data.workspacePath;
    this.semanticResult = data.semanticResult;
    this.plannerResult = data.plannerResult;
    this.history = data.history;
    this.excludedOperationKeys = data.excludedOperationKeys ?? new Set();
    this.morphProject = data.morphProject;
  }

  setMorphProject(project: Project): void {
    this.morphProject = project;
  }

  getMorphProject(): Project {
    if (!this.morphProject) {
      throw new Error('El proyecto ts-morph no está inicializado en RewriteContext');
    }

    return this.morphProject;
  }

  getRewriteableOperations(): SemanticOperation[] {
    return new PlannerContext(this.semanticResult)
      .getTransformableOperations()
      .filter((operation) => !this.excludedOperationKeys.has(`${operation.file}:${operation.line}`));
  }
}
