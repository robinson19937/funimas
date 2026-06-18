import type { RollbackAction } from './RollbackAction.js';

export interface RollbackResultData {
  success: boolean;
  transformationId: string;
  actions: RollbackAction[];
  reason: string;
  startedAt: Date;
  finishedAt: Date;
}

export class RollbackResult {
  readonly success: boolean;
  readonly transformationId: string;
  readonly actions: RollbackAction[];
  readonly reason: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: RollbackResultData) {
    this.success = data.success;
    this.transformationId = data.transformationId;
    this.actions = data.actions;
    this.reason = data.reason;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
}
