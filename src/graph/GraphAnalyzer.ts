import type { DependencyGraph } from './DependencyGraph.js';
import { DependencyNode } from './DependencyNode.js';

export class GraphAnalyzer {
  constructor(private readonly graph: DependencyGraph) {}

  findOrphanFiles(): DependencyNode[] {
    return this.graph.getNodes().filter((node) => this.graph.getAllNeighbors(node.id).length === 0);
  }

  findCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      stack.add(nodeId);
      path.push(nodeId);

      for (const dependency of this.graph.getDirectDependencies(nodeId)) {
        if (!visited.has(dependency.id)) {
          dfs(dependency.id);
          continue;
        }

        if (stack.has(dependency.id)) {
          const cycleStartIndex = path.indexOf(dependency.id);
          cycles.push([...path.slice(cycleStartIndex), dependency.id]);
        }
      }

      stack.delete(nodeId);
      path.pop();
    };

    for (const node of this.graph.getNodes()) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  findEntryPoints(): DependencyNode[] {
    return this.graph
      .getNodes()
      .filter(
        (node) =>
          this.graph.getReverseDependencies(node.id).length === 0 &&
          this.graph.getDirectDependencies(node.id).length > 0,
      );
  }

  findLeafNodes(): DependencyNode[] {
    return this.graph.getNodes().filter((node) => this.graph.getDirectDependencies(node.id).length === 0);
  }

  findDependencies(file: string): DependencyNode[] {
    const node = this.graph.findNode(file);

    if (!node) {
      return [];
    }

    return this.graph.getDirectDependencies(node.id);
  }

  findDependents(file: string): DependencyNode[] {
    const node = this.graph.findNode(file);

    if (!node) {
      return [];
    }

    return this.graph.getReverseDependencies(node.id);
  }
}
