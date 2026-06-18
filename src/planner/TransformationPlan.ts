import type { TransformationAction } from './TransformationAction.js';
import { ActionDependencyResolver } from './ActionDependencyResolver.js';

export interface TransformationPlanExport {
  actions: TransformationAction[];
  orderedActionIds: string[];
}

/**
 * Colección ordenable de acciones de transformación con resolución de dependencias.
 */
export class TransformationPlan {
  private readonly actions = new Map<string, TransformationAction>();

  addAction(action: TransformationAction): void {
    this.actions.set(action.id, action);
  }

  removeAction(actionId: string): boolean {
    return this.actions.delete(actionId);
  }

  findAction(actionId: string): TransformationAction | undefined {
    return this.actions.get(actionId);
  }

  getActions(): TransformationAction[] {
    return [...this.actions.values()];
  }

  sortByPriority(): TransformationAction[] {
    return this.getActions().sort((left, right) => {
      const priorityDiff =
        this.getPriorityWeight(left.priority) - this.getPriorityWeight(right.priority);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return left.description.localeCompare(right.description);
    });
  }

  resolveDependencies(): TransformationAction[] {
    const resolver = new ActionDependencyResolver();
    return resolver.resolve(this.getActions());
  }

  export(): TransformationPlanExport {
    const orderedActions = this.resolveDependencies();

    return {
      actions: this.getActions(),
      orderedActionIds: orderedActions.map((action) => action.id),
    };
  }

  private getPriorityWeight(priority: TransformationAction['priority']): number {
    const weights = {
      CRITICAL: 0,
      HIGH: 1,
      NORMAL: 2,
      LOW: 3,
    } as const;

    return weights[priority];
  }
}
