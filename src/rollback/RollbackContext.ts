import type { TransformationHistory } from '../history/TransformationHistory.js';

export interface RollbackContextData {
  workspacePath: string;
  history: TransformationHistory;
  reason?: string;
}

export class RollbackContext {
  readonly workspacePath: string;
  readonly history: TransformationHistory;
  readonly reason: string;

  constructor(data: RollbackContextData) {
    this.workspacePath = data.workspacePath;
    this.history = data.history;
    this.reason = data.reason ?? 'Validation failed';
  }
}
