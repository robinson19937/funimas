import { Project } from 'ts-morph';

import type { GraphResult } from '../graph/GraphResult.js';

import { RuleRegistry } from './RuleRegistry.js';
import { SemanticContext } from './SemanticContext.js';
import { SemanticResult } from './SemanticResult.js';
import {
  SEMANTIC_OPERATION_TYPES,
  type SemanticOperationType,
} from './SemanticOperationType.js';
import type { SemanticOperation } from './SemanticOperation.js';
import { FirebaseAuthRule } from './rules/FirebaseAuthRule.js';
import { FirebaseImportRule } from './rules/FirebaseImportRule.js';
import { FirebaseStorageRule } from './rules/FirebaseStorageRule.js';
import { FirestoreRule } from './rules/FirestoreRule.js';

export interface SemanticAnalyzerService {
  analyze(graph: GraphResult): Promise<SemanticResult>;
}

export interface SemanticAnalyzerOptions {
  now?: () => Date;
  registry?: RuleRegistry;
}

export function createDefaultRuleRegistry(): RuleRegistry {
  const registry = new RuleRegistry();

  registry.registerMany([
    new FirebaseImportRule(),
    new FirestoreRule(),
    new FirebaseAuthRule(),
    new FirebaseStorageRule(),
  ]);

  return registry;
}

export class SemanticAnalyzer implements SemanticAnalyzerService {
  private readonly now: () => Date;
  private readonly registry: RuleRegistry;

  constructor(options: SemanticAnalyzerOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.registry = options.registry ?? createDefaultRuleRegistry();
  }

  getRegistry(): RuleRegistry {
    return this.registry;
  }

  async analyze(graph: GraphResult): Promise<SemanticResult> {
    const startedAt = this.now();
    const context = await this.buildContext(graph);
    const operations = await this.registry.runAll(context);
    const finishedAt = this.now();

    return new SemanticResult({
      operations,
      totalOperations: operations.length,
      operationsByType: this.countOperationsByType(operations),
      startedAt,
      finishedAt,
    });
  }

  private async buildContext(graph: GraphResult): Promise<SemanticContext> {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true,
      },
    });

    for (const node of graph.graph.getNodes()) {
      project.addSourceFileAtPath(node.path);
    }

    return new SemanticContext(graph, project);
  }

  private countOperationsByType(
    operations: SemanticOperation[],
  ): Record<SemanticOperationType, number> {
    const counts = Object.fromEntries(
      SEMANTIC_OPERATION_TYPES.map((type) => [type, 0]),
    ) as Record<SemanticOperationType, number>;

    for (const operation of operations) {
      counts[operation.type] += 1;
    }

    return counts;
  }
}
