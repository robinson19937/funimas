import type { TransformationAction } from './TransformationAction.js';

export class ActionGraph {
  private readonly actions = new Map<string, TransformationAction>();
  private readonly dependencies = new Map<string, Set<string>>();

  addAction(action: TransformationAction): void {
    this.actions.set(action.id, action);
    this.dependencies.set(action.id, new Set(action.dependencies));
  }

  getAction(actionId: string): TransformationAction | undefined {
    return this.actions.get(actionId);
  }

  getActions(): TransformationAction[] {
    return [...this.actions.values()];
  }

  getDependencies(actionId: string): string[] {
    return [...(this.dependencies.get(actionId) ?? [])];
  }

  getDependents(actionId: string): string[] {
    const dependents: string[] = [];

    for (const [id, dependencySet] of this.dependencies.entries()) {
      if (dependencySet.has(actionId)) {
        dependents.push(id);
      }
    }

    return dependents;
  }
}
