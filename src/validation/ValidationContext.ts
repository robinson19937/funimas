import type { TransformationHistory } from '../history/TransformationHistory.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';

export interface ValidationContextData {
  projectPath: string;
  workspacePath: string;
  history?: TransformationHistory;
  semanticResult?: SemanticResult;
}

export class ValidationContext {
  readonly projectPath: string;
  readonly workspacePath: string;
  readonly history?: TransformationHistory;
  readonly semanticResult?: SemanticResult;

  constructor(data: ValidationContextData) {
    this.projectPath = data.projectPath;
    this.workspacePath = data.workspacePath;
    this.history = data.history;
    this.semanticResult = data.semanticResult;
  }
}
