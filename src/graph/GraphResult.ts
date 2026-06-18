import type { DependencyGraph } from './DependencyGraph.js';

export interface GraphResultData {
  graph: DependencyGraph;
  totalNodes: number;
  totalEdges: number;
  totalImports: number;
  totalConnectedComponents: number;
  startedAt: Date;
  finishedAt: Date;
}

export class GraphResult {
  readonly graph: DependencyGraph;
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly totalImports: number;
  readonly totalConnectedComponents: number;
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: GraphResultData) {
    this.graph = data.graph;
    this.totalNodes = data.totalNodes;
    this.totalEdges = data.totalEdges;
    this.totalImports = data.totalImports;
    this.totalConnectedComponents = data.totalConnectedComponents;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
}
