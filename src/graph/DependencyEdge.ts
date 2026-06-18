export const DEPENDENCY_EDGE_TYPES = ['IMPORT', 'EXPORT', 'DYNAMIC_IMPORT'] as const;

export type DependencyEdgeType = (typeof DEPENDENCY_EDGE_TYPES)[number];

export interface DependencyEdgeData {
  origin: string;
  destination: string;
  type: DependencyEdgeType;
}

export class DependencyEdge {
  readonly origin: string;
  readonly destination: string;
  readonly type: DependencyEdgeType;

  constructor(data: DependencyEdgeData) {
    this.origin = data.origin;
    this.destination = data.destination;
    this.type = data.type;
  }
}
