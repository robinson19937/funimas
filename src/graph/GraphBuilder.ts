import { dirname, extname, normalize, resolve } from 'node:path';

import type { ScanResult } from '../scanner/ScanResult.js';
import type { FileInfo } from '../scanner/FileInfo.js';

import { DependencyEdge } from './DependencyEdge.js';
import { DependencyGraph } from './DependencyGraph.js';
import { DependencyNode } from './DependencyNode.js';
import { GraphResult } from './GraphResult.js';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const;

export interface GraphBuilderService {
  build(scanResult: ScanResult): GraphResult;
}

export interface GraphBuilderOptions {
  now?: () => Date;
}

export class GraphBuilder implements GraphBuilderService {
  private readonly now: () => Date;

  constructor(options: GraphBuilderOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  build(scanResult: ScanResult): GraphResult {
    const startedAt = this.now();
    const graph = new DependencyGraph();
    const fileIndex = this.createFileIndex(scanResult.files);

    for (const file of scanResult.files) {
      graph.addNode(this.createNode(file));
    }

    for (const file of scanResult.files) {
      this.addImportEdges(graph, file, fileIndex);
      this.addExportEdges(graph, file, fileIndex);
    }

    const finishedAt = this.now();
    const importEdges = graph.getEdgesByType('IMPORT');

    return new GraphResult({
      graph,
      totalNodes: graph.getNodes().length,
      totalEdges: graph.getEdges().length,
      totalImports: importEdges.length,
      totalConnectedComponents: this.countConnectedComponents(graph),
      startedAt,
      finishedAt,
    });
  }

  private createFileIndex(files: FileInfo[]): Map<string, string> {
    const index = new Map<string, string>();

    for (const file of files) {
      const normalizedPath = normalize(file.path);
      index.set(normalizedPath, normalizedPath);

      const pathWithoutExtension = normalizedPath.slice(0, -file.extension.length);
      index.set(pathWithoutExtension, normalizedPath);
    }

    return index;
  }

  private createNode(file: FileInfo): DependencyNode {
    return new DependencyNode({
      id: normalize(file.path),
      name: file.name,
      path: normalize(file.path),
      extension: file.extension,
      size: file.size,
      imports: file.imports,
      exports: file.exports,
    });
  }

  private addImportEdges(
    graph: DependencyGraph,
    file: FileInfo,
    fileIndex: Map<string, string>,
  ): void {
    const originId = normalize(file.path);

    for (const importInfo of file.imports) {
      const destinationId = this.resolveModulePath(file.path, importInfo.moduleSpecifier, fileIndex);

      if (!destinationId) {
        continue;
      }

      graph.addEdge(
        new DependencyEdge({
          origin: originId,
          destination: destinationId,
          type: this.resolveImportEdgeType(importInfo.moduleSpecifier),
        }),
      );
    }
  }

  private addExportEdges(
    graph: DependencyGraph,
    file: FileInfo,
    fileIndex: Map<string, string>,
  ): void {
    if (file.exports.length === 0) {
      return;
    }

    const destinationId = normalize(file.path);

    for (const otherFile of graph.getNodes()) {
      if (otherFile.id === destinationId) {
        continue;
      }

      const dependsOnExportedFile = otherFile.imports.some((importInfo) => {
        const resolvedPath = this.resolveModulePath(
          otherFile.path,
          importInfo.moduleSpecifier,
          fileIndex,
        );

        return resolvedPath === destinationId;
      });

      if (dependsOnExportedFile) {
        graph.addEdge(
          new DependencyEdge({
            origin: destinationId,
            destination: otherFile.id,
            type: 'EXPORT',
          }),
        );
      }
    }
  }

  private resolveModulePath(
    fromFilePath: string,
    moduleSpecifier: string,
    fileIndex: Map<string, string>,
  ): string | undefined {
    if (!moduleSpecifier.startsWith('.')) {
      return undefined;
    }

    const resolvedBase = normalize(resolve(dirname(fromFilePath), moduleSpecifier));
    const candidates = this.createResolutionCandidates(resolvedBase);

    for (const candidate of candidates) {
      const match = fileIndex.get(candidate);

      if (match) {
        return match;
      }
    }

    return undefined;
  }

  private createResolutionCandidates(basePath: string): string[] {
    const extension = extname(basePath);
    const candidates = new Set<string>([basePath]);

    if (extension) {
      const pathWithoutExtension = basePath.slice(0, -extension.length);

      for (const sourceExtension of SOURCE_EXTENSIONS) {
        candidates.add(`${pathWithoutExtension}${sourceExtension}`);
      }

      return [...candidates];
    }

    for (const sourceExtension of SOURCE_EXTENSIONS) {
      candidates.add(`${basePath}${sourceExtension}`);
      candidates.add(normalize(resolve(basePath, `index${sourceExtension}`)));
    }

    return [...candidates];
  }

  private resolveImportEdgeType(moduleSpecifier: string): 'IMPORT' | 'DYNAMIC_IMPORT' {
    if (moduleSpecifier.includes('import(')) {
      return 'DYNAMIC_IMPORT';
    }

    return 'IMPORT';
  }

  private countConnectedComponents(graph: DependencyGraph): number {
    const nodes = graph.getNodes();
    const visited = new Set<string>();
    let components = 0;

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);

      const currentNode = graph.findNode(nodeId);

      if (!currentNode) {
        return;
      }

      for (const neighbor of graph.getAllNeighbors(nodeId)) {
        if (!visited.has(neighbor.id)) {
          dfs(neighbor.id);
        }
      }
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        components += 1;
        dfs(node.id);
      }
    }

    return components;
  }
}
