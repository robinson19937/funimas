import { DependencyEdge, type DependencyEdgeType } from './DependencyEdge.js';
import { DependencyNode } from './DependencyNode.js';

export class DependencyGraph {
  private readonly nodes = new Map<string, DependencyNode>();
  private readonly edges: DependencyEdge[] = [];
  private readonly outgoingEdges = new Map<string, DependencyEdge[]>();
  private readonly incomingEdges = new Map<string, DependencyEdge[]>();

  addNode(node: DependencyNode): void {
    this.nodes.set(node.id, node);

    if (!this.outgoingEdges.has(node.id)) {
      this.outgoingEdges.set(node.id, []);
    }

    if (!this.incomingEdges.has(node.id)) {
      this.incomingEdges.set(node.id, []);
    }
  }

  addEdge(edge: DependencyEdge): void {
    if (!this.nodes.has(edge.origin) || !this.nodes.has(edge.destination)) {
      return;
    }

    this.edges.push(edge);
    this.outgoingEdges.get(edge.origin)?.push(edge);
    this.incomingEdges.get(edge.destination)?.push(edge);
  }

  findNode(idOrPath: string): DependencyNode | undefined {
    const directMatch = this.nodes.get(idOrPath);

    if (directMatch) {
      return directMatch;
    }

    return [...this.nodes.values()].find((node) => node.path === idOrPath || node.name === idOrPath);
  }

  getNodes(): DependencyNode[] {
    return [...this.nodes.values()];
  }

  getEdges(): DependencyEdge[] {
    return [...this.edges];
  }

  getDirectDependencies(nodeId: string): DependencyNode[] {
    const normalizedId = this.resolveNodeId(nodeId);
    const edges = this.outgoingEdges.get(normalizedId) ?? [];

    return edges
      .filter((edge) => edge.type === 'IMPORT' || edge.type === 'DYNAMIC_IMPORT')
      .map((edge) => this.nodes.get(edge.destination))
      .filter((node): node is DependencyNode => node !== undefined);
  }

  getReverseDependencies(nodeId: string): DependencyNode[] {
    const normalizedId = this.resolveNodeId(nodeId);
    const edges = this.incomingEdges.get(normalizedId) ?? [];

    return edges
      .filter((edge) => edge.type === 'IMPORT' || edge.type === 'DYNAMIC_IMPORT')
      .map((edge) => this.nodes.get(edge.origin))
      .filter((node): node is DependencyNode => node !== undefined);
  }

  getAllNeighbors(nodeId: string): DependencyNode[] {
    const normalizedId = this.resolveNodeId(nodeId);
    const neighbors = new Map<string, DependencyNode>();

    for (const node of this.getOutgoingNeighbors(normalizedId)) {
      neighbors.set(node.id, node);
    }

    for (const node of this.getIncomingNeighbors(normalizedId)) {
      neighbors.set(node.id, node);
    }

    return [...neighbors.values()];
  }

  getEdgesByType(type: DependencyEdgeType): DependencyEdge[] {
    return this.edges.filter((edge) => edge.type === type);
  }

  private getOutgoingNeighbors(nodeId: string): DependencyNode[] {
    const edges = this.outgoingEdges.get(nodeId) ?? [];

    return edges
      .map((edge) => this.nodes.get(edge.destination))
      .filter((node): node is DependencyNode => node !== undefined);
  }

  private getIncomingNeighbors(nodeId: string): DependencyNode[] {
    const edges = this.incomingEdges.get(nodeId) ?? [];

    return edges
      .map((edge) => this.nodes.get(edge.origin))
      .filter((node): node is DependencyNode => node !== undefined);
  }

  private resolveNodeId(idOrPath: string): string {
    return this.findNode(idOrPath)?.id ?? idOrPath;
  }
}
