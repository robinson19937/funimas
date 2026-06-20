import { relative, resolve } from 'node:path';

import type { TransformationRecord } from '../history/TransformationRecord.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';
import { operationKey } from '../domain/DomainMutation.js';
import { getUnsupportedFirestoreRecommendation } from '../status/firestore-api-catalog.js';

export type UntransformedReason =
  | 'unsupported-api'
  | 'storage-not-supported'
  | 'not-transformed'
  | 'intentionally-client-side';

export interface UntransformedOperationFinding {
  file: string;
  line: number;
  callee?: string;
  operationType: string;
  reason: UntransformedReason;
  recommendation: string;
  blocking: boolean;
}

const CLIENT_SIDE_OPERATION_TYPES = new Set([
  'AUTH_LOGIN',
  'AUTH_REGISTER',
  'AUTH_LOGOUT',
]);

const GENERATED_WORKSPACE_PREFIXES = [
  'runtime/',
  'shared/',
  'sdk/',
  'netlify/functions/',
] as const;

function isGeneratedWorkspaceFile(relativeFile: string): boolean {
  return GENERATED_WORKSPACE_PREFIXES.some((prefix) => relativeFile.startsWith(prefix));
}

function toRelativePath(workspacePath: string, filePath: string): string {
  const workspaceRoot = resolve(workspacePath);

  if (filePath.startsWith(workspaceRoot)) {
    return relative(workspaceRoot, filePath);
  }

  return filePath;
}

function getCallee(operation: SemanticOperation): string | undefined {
  return typeof operation.metadata.callee === 'string' ? operation.metadata.callee : undefined;
}

function isImportOperation(operation: SemanticOperation): boolean {
  return operation.type === 'CUSTOM' && operation.metadata.category === 'import';
}

function buildRewrittenPositions(records: TransformationRecord[]): Set<string> {
  const positions = new Set<string>();

  for (const record of records) {
    if (record.before.length === 0) {
      continue;
    }

    if (record.sourceLine !== undefined) {
      positions.add(`${record.file}:${record.sourceLine}`);
    }
  }

  return positions;
}

function wasTransformed(operation: SemanticOperation, rewrittenPositions: Set<string>): boolean {
  return rewrittenPositions.has(`${operation.file}:${operation.line}`);
}

export function analyzeUntransformedOperations(options: {
  workspacePath: string;
  semanticResult: SemanticResult;
  records: TransformationRecord[];
  domainMutationOperationKeys?: Set<string>;
}): UntransformedOperationFinding[] {
  const { workspacePath, semanticResult, records, domainMutationOperationKeys } = options;
  const rewrittenPositions = buildRewrittenPositions(records);
  const findings: UntransformedOperationFinding[] = [];

  for (const operation of semanticResult.operations) {
    if (isImportOperation(operation)) {
      continue;
    }

    if (domainMutationOperationKeys?.has(operationKey(operation.file, operation.line))) {
      continue;
    }

    if (CLIENT_SIDE_OPERATION_TYPES.has(operation.type)) {
      continue;
    }

    const callee = getCallee(operation);
    const relativeFile = toRelativePath(workspacePath, operation.file);

    if (isGeneratedWorkspaceFile(relativeFile)) {
      continue;
    }

    if (operation.metadata.supported === false) {
      findings.push({
        file: relativeFile,
        line: operation.line,
        callee,
        operationType: operation.type,
        reason: 'unsupported-api',
        recommendation: callee
          ? getUnsupportedFirestoreRecommendation(callee)
          : 'Migrar manualmente a operaciones del SDK Funimas o lógica en el servidor.',
        blocking: true,
      });
      continue;
    }

    if (operation.type === 'FILE_UPLOAD' || operation.type === 'FILE_DELETE') {
      findings.push({
        file: relativeFile,
        line: operation.line,
        callee,
        operationType: operation.type,
        reason: 'storage-not-supported',
        recommendation:
          'Firebase Storage no tiene transformación automática. Migra subidas/descargas manualmente.',
        blocking: false,
      });
      continue;
    }

    if (operation.metadata.category !== 'firestore') {
      continue;
    }

    if (wasTransformed(operation, rewrittenPositions)) {
      continue;
    }

    findings.push({
      file: relativeFile,
      line: operation.line,
      callee,
      operationType: operation.type,
      reason: 'not-transformed',
      recommendation:
        'Esta operación Firestore quedó en el cliente. Revisa el patrón o migra manualmente al SDK Funimas.',
      blocking: false,
    });
  }

  return findings.sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }

    return left.line - right.line;
  });
}

export function hasBlockingUntransformedOperations(
  findings: UntransformedOperationFinding[],
): boolean {
  return findings.some((finding) => finding.blocking);
}
