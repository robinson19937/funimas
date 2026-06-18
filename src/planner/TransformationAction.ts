import { randomUUID } from 'node:crypto';

import type { ActionPriority } from './ActionPriority.js';
import type { ActionType } from './ActionType.js';

export const ACTION_STATUSES = ['PENDING', 'READY', 'COMPLETED', 'SKIPPED', 'FAILED'] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface TransformationActionData {
  id?: string;
  type: ActionType;
  description: string;
  priority: ActionPriority;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
  status?: ActionStatus;
}

export class TransformationAction {
  readonly id: string;
  readonly type: ActionType;
  readonly description: string;
  readonly priority: ActionPriority;
  readonly dependencies: string[];
  readonly metadata: Record<string, unknown>;
  status: ActionStatus;

  constructor(data: TransformationActionData) {
    this.id = data.id ?? randomUUID();
    this.type = data.type;
    this.description = data.description;
    this.priority = data.priority;
    this.dependencies = data.dependencies ?? [];
    this.metadata = data.metadata ?? {};
    this.status = data.status ?? 'PENDING';
  }
}
