import { ACTION_PRIORITY_ORDER, type ActionPriority } from './ActionPriority.js';
import { ACTION_TYPE_ORDER, type ActionType } from './ActionType.js';
import { ActionGraph } from './ActionGraph.js';
import type { TransformationAction } from './TransformationAction.js';

export class ActionDependencyResolver {
  resolve(actions: TransformationAction[]): TransformationAction[] {
    const graph = new ActionGraph();

    for (const action of actions) {
      graph.addAction(action);
    }

    const indegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const action of actions) {
      indegree.set(action.id, 0);
      adjacency.set(action.id, []);
    }

    for (const action of actions) {
      for (const dependencyId of action.dependencies) {
        if (!graph.getAction(dependencyId)) {
          continue;
        }

        adjacency.get(dependencyId)?.push(action.id);
        indegree.set(action.id, (indegree.get(action.id) ?? 0) + 1);
      }
    }

    const queue = actions
      .filter((action) => (indegree.get(action.id) ?? 0) === 0)
      .sort(this.compareActions.bind(this));

    const ordered: TransformationAction[] = [];

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        break;
      }

      ordered.push(current);

      for (const dependentId of adjacency.get(current.id) ?? []) {
        const nextIndegree = (indegree.get(dependentId) ?? 0) - 1;
        indegree.set(dependentId, nextIndegree);

        if (nextIndegree === 0) {
          const dependent = graph.getAction(dependentId);

          if (dependent) {
            queue.push(dependent);
            queue.sort(this.compareActions.bind(this));
          }
        }
      }
    }

    if (ordered.length !== actions.length) {
      const remaining = actions
        .filter((action) => !ordered.some((orderedAction) => orderedAction.id === action.id))
        .sort(this.compareActions.bind(this));

      ordered.push(...remaining);
    }

    return ordered;
  }

  private compareActions(left: TransformationAction, right: TransformationAction): number {
    const typeOrder =
      ACTION_TYPE_ORDER[left.type as ActionType] - ACTION_TYPE_ORDER[right.type as ActionType];

    if (typeOrder !== 0) {
      return typeOrder;
    }

    const priorityOrder =
      ACTION_PRIORITY_ORDER[left.priority as ActionPriority] -
      ACTION_PRIORITY_ORDER[right.priority as ActionPriority];

    if (priorityOrder !== 0) {
      return priorityOrder;
    }

    return left.id.localeCompare(right.id);
  }
}
