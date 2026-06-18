import type { PlatformAdapter } from '../adapters/PlatformAdapter.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';

export interface GeneratorContextData {
  projectPath: string;
  workspacePath: string;
  semanticResult: SemanticResult;
  adapter?: PlatformAdapter;
}

/**
 * Contexto compartido para los generadores de código del MVP.
 */
export class GeneratorContext {
  readonly projectPath: string;
  readonly workspacePath: string;
  readonly semanticResult: SemanticResult;
  readonly adapter?: PlatformAdapter;

  constructor(data: GeneratorContextData) {
    this.projectPath = data.projectPath;
    this.workspacePath = data.workspacePath;
    this.semanticResult = data.semanticResult;
    this.adapter = data.adapter;
  }
}
