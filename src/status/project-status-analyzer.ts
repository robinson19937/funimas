import { resolve } from 'node:path';

import { GraphBuilder } from '../graph/GraphBuilder.js';
import { AstParser } from '../parser/AstParser.js';
import { ProjectScanner } from '../scanner/ProjectScanner.js';
import { SemanticAnalyzer } from '../semantic/index.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';
import { assertProjectDirectoryExists } from '../workspace/WorkspaceUtils.js';
import {
  getUnsupportedFirestoreRecommendation,
  isSupportedFirestoreCallee,
} from './firestore-api-catalog.js';

export interface UnsupportedApiFinding {
  callee: string;
  file: string;
  line: number;
  recommendation: string;
}

export interface ProjectStatusReport {
  projectPath: string;
  isWorkspace: boolean;
  firestoreSupported: Record<string, number>;
  firestoreUnsupported: Record<string, number>;
  unsupportedFindings: UnsupportedApiFinding[];
  authOperations: number;
  storageOperations: number;
  totalFirestoreOperations: number;
  productionReady: boolean;
  blockers: string[];
}

export class ProjectStatusAnalyzer {
  private readonly astParser = new AstParser();
  private readonly projectScanner = new ProjectScanner();
  private readonly graphBuilder = new GraphBuilder();
  private readonly semanticAnalyzer = new SemanticAnalyzer();

  async analyze(projectPath: string): Promise<ProjectStatusReport> {
    const resolvedPath = resolve(projectPath);
    await assertProjectDirectoryExists(resolvedPath);

    const parseResult = await this.astParser.parse(resolvedPath);
    const scanResult = await this.projectScanner.scan(parseResult.project);
    const graphResult = this.graphBuilder.build(scanResult);
    const semanticResult = await this.semanticAnalyzer.analyze(graphResult);

    const firestoreOps = semanticResult.getOperationsByMetadata('category', 'firestore');
    const firestoreSupported: Record<string, number> = {};
    const firestoreUnsupported: Record<string, number> = {};
    const unsupportedFindings: UnsupportedApiFinding[] = [];

    for (const operation of firestoreOps) {
      const callee = this.getCallee(operation);

      if (!callee) {
        continue;
      }

      if (operation.metadata.supported === false || !isSupportedFirestoreCallee(callee)) {
        firestoreUnsupported[callee] = (firestoreUnsupported[callee] ?? 0) + 1;
        unsupportedFindings.push({
          callee,
          file: operation.file,
          line: operation.line,
          recommendation: getUnsupportedFirestoreRecommendation(callee),
        });
        continue;
      }

      firestoreSupported[callee] = (firestoreSupported[callee] ?? 0) + 1;
    }

    const authOperations = semanticResult.getOperationsByMetadata('category', 'auth').length;
    const storageOperations = semanticResult
      .getOperationsByMetadata('category', 'storage')
      .filter((operation) => operation.type === 'FILE_UPLOAD' || operation.type === 'FILE_DELETE')
      .length;

    const blockers: string[] = [];

    if (unsupportedFindings.length > 0) {
      blockers.push(
        `${unsupportedFindings.length} uso(s) de APIs Firestore no soportadas por Funimas`,
      );
    }

    if (storageOperations > 0) {
      blockers.push(
        `${storageOperations} operación(es) de Firebase Storage sin transformación automática`,
      );
    }

    return {
      projectPath: resolvedPath,
      isWorkspace: resolvedPath.endsWith('_funimas'),
      firestoreSupported,
      firestoreUnsupported,
      unsupportedFindings,
      authOperations,
      storageOperations,
      totalFirestoreOperations: firestoreOps.length,
      productionReady: blockers.length === 0,
      blockers,
    };
  }

  private getCallee(operation: SemanticOperation): string | undefined {
    return typeof operation.metadata.callee === 'string' ? operation.metadata.callee : undefined;
  }
}
