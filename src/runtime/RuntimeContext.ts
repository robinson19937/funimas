import type { TransformationHistory } from '../history/TransformationHistory.js';

export interface RuntimeContextData {
  projectPath: string;
  workspacePath: string;
  history?: TransformationHistory;
  collections?: string[];
}

export class RuntimeContext {
  readonly projectPath: string;
  readonly workspacePath: string;
  readonly history?: TransformationHistory;
  readonly collections: string[];

  constructor(data: RuntimeContextData) {
    this.projectPath = data.projectPath;
    this.workspacePath = data.workspacePath;
    this.history = data.history;
    this.collections = data.collections ?? [];
  }
}
