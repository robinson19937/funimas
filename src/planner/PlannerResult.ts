import type { TransformationPlan } from './TransformationPlan.js';
import type { ActionType } from './ActionType.js';
import { ACTION_TYPES } from './ActionType.js';
import type { TransformationAction } from './TransformationAction.js';

export interface PlannerResultData {
  plan: TransformationPlan;
  totalActions: number;
  actionsByType: Record<ActionType, number>;
  estimatedModifiedFiles: number;
  estimatedGeneratedFiles: number;
  estimatedExecutionTime: number;
  startedAt: Date;
  finishedAt: Date;
}

export class PlannerResult {
  readonly plan: TransformationPlan;
  readonly totalActions: number;
  readonly actionsByType: Record<ActionType, number>;
  readonly estimatedModifiedFiles: number;
  readonly estimatedGeneratedFiles: number;
  readonly estimatedExecutionTime: number;
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: PlannerResultData) {
    this.plan = data.plan;
    this.totalActions = data.totalActions;
    this.actionsByType = data.actionsByType;
    this.estimatedModifiedFiles = data.estimatedModifiedFiles;
    this.estimatedGeneratedFiles = data.estimatedGeneratedFiles;
    this.estimatedExecutionTime = data.estimatedExecutionTime;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }

  getOrderedActions(): TransformationAction[] {
    return this.plan.resolveDependencies();
  }

  getActionsByType(type: ActionType): TransformationAction[] {
    return this.plan.getActions().filter((action) => action.type === type);
  }
}

export function createEmptyActionsByType(): Record<ActionType, number> {
  return Object.fromEntries(ACTION_TYPES.map((type) => [type, 0])) as Record<ActionType, number>;
}
