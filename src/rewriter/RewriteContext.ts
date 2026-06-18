import type { SemanticResult } from '../semantic/SemanticResult.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';
import { PlannerContext } from '../planner/PlannerContext.js';
import type { Project } from 'ts-morph';

export interface RewriteContextData {
  projectPath: string;
  workspacePath: string;
  semanticResult: SemanticResult;
  morphProject?: Project;
}

/**
 * Contexto de reescritura limitado al workspace de trabajo.
 */
export class RewriteContext {
  readonly projectPath: string;
  readonly workspacePath: string;
  readonly semanticResult: SemanticResult;
  private morphProject?: Project;

  constructor(data: RewriteContextData) {
    this.projectPath = data.projectPath;
    this.workspacePath = data.workspacePath;
    this.semanticResult = data.semanticResult;
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
    return new PlannerContext(this.semanticResult).getTransformableOperations();
  }
}
