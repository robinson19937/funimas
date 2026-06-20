import { basename, relative, resolve } from 'node:path';

import type { TransformationRecord } from '../history/TransformationRecord.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';
import {
  analyzeUntransformedOperations,
  type UntransformedOperationFinding,
} from './untransformed-operations-analyzer.js';

const GENERATED_OPERATIONS = new Set([
  'GENERATE_RUNTIME',
  'GENERATE_SDK',
  'GENERATE_FUNCTION',
  'GENERATE_SHARED',
]);

export interface ReportRewriteChange {
  before: string;
  after: string;
  rewriteRule: string;
  operation: string;
  reason: string;
  benefit: string;
  riskLevel: string;
  sourceLine?: number;
  status: string;
  validationStatus: string;
  rollbackExecuted: boolean;
  generatedFiles: string[];
}

export interface ReportFileChanges {
  relativeFile: string;
  changes: ReportRewriteChange[];
}

export interface ChangeReportViewModel {
  funimasVersion: string;
  date: string;
  duration: number;
  executionId: string;
  stats: {
    filesModified: number;
    codeChanges: number;
    filesGenerated: number;
    operationsTransformed: number;
    operationsUntransformed: number;
  };
  fileChanges: ReportFileChanges[];
  untransformedOperations: UntransformedOperationFinding[];
  workspaceReady: boolean;
  generatedArtifacts: {
    runtime: string[];
    sdk: string[];
    functions: string[];
    shared: string[];
    other: string[];
  };
  operationsFound: Record<string, number>;
  operationsTransformed: Record<string, number>;
}

export function toWorkspaceRelativePath(workspacePath: string, filePath: string): string {
  const workspaceRoot = resolve(workspacePath);

  if (filePath.startsWith(workspaceRoot)) {
    return relative(workspaceRoot, filePath);
  }

  return basename(filePath);
}

function isCodeRewrite(record: TransformationRecord): boolean {
  return record.before.length > 0;
}

function isGeneratedArtifact(record: TransformationRecord): boolean {
  return (
    record.before.length === 0 &&
    (GENERATED_OPERATIONS.has(record.operation) || record.after.length > 0)
  );
}

function categorizeGeneratedPath(path: string): keyof ChangeReportViewModel['generatedArtifacts'] {
  if (path.startsWith('runtime/')) {
    return 'runtime';
  }

  if (path.startsWith('sdk/')) {
    return 'sdk';
  }

  if (path.startsWith('netlify/functions/')) {
    return 'functions';
  }

  if (path.startsWith('shared/')) {
    return 'shared';
  }

  return 'other';
}

export function buildChangeReportViewModel(options: {
  workspacePath: string;
  records: TransformationRecord[];
  semanticResult: SemanticResult;
  duration: number;
  finishedAt: Date;
  funimasVersion: string;
  executionId: string;
}): ChangeReportViewModel {
  const { workspacePath, records, semanticResult, duration, finishedAt, funimasVersion, executionId } =
    options;
  const domainMutationOperationKeys = new Set(
    semanticResult.domainMutations.flatMap((mutation) => mutation.operationKeys),
  );

  const rewriteRecords = records.filter(isCodeRewrite);
  const generatedRecords = records.filter(isGeneratedArtifact);

  const changesByFile = new Map<string, ReportRewriteChange[]>();

  for (const record of rewriteRecords) {
    const relativeFile = toWorkspaceRelativePath(workspacePath, record.file);
    const changes = changesByFile.get(relativeFile) ?? [];

    changes.push({
      before: record.before,
      after: record.after,
      rewriteRule: record.rewriteRule,
      operation: record.operation,
      reason: record.reason,
      benefit: record.benefit,
      riskLevel: record.riskLevel,
      sourceLine: record.sourceLine,
      status: record.status,
      validationStatus: record.validationStatus,
      rollbackExecuted: record.rollbackExecuted,
      generatedFiles: record.generatedFiles,
    });

    changesByFile.set(relativeFile, changes);
  }

  const fileChanges = [...changesByFile.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([relativeFile, changes]) => ({
      relativeFile,
      changes: changes.sort((left, right) => (left.sourceLine ?? 0) - (right.sourceLine ?? 0)),
    }));

  const generatedArtifacts: ChangeReportViewModel['generatedArtifacts'] = {
    runtime: [],
    sdk: [],
    functions: [],
    shared: [],
    other: [],
  };

  const seenGenerated = new Set<string>();

  for (const record of generatedRecords) {
    const candidates =
      record.generatedFiles.length > 0
        ? record.generatedFiles
        : [toWorkspaceRelativePath(workspacePath, record.file)];

    for (const candidate of candidates) {
      if (seenGenerated.has(candidate)) {
        continue;
      }

      seenGenerated.add(candidate);
      generatedArtifacts[categorizeGeneratedPath(candidate)].push(candidate);
    }
  }

  for (const bucket of Object.values(generatedArtifacts)) {
    bucket.sort();
  }

  const operationsTransformed = rewriteRecords.reduce<Record<string, number>>((counts, record) => {
    counts[record.operation] = (counts[record.operation] ?? 0) + 1;
    return counts;
  }, {});

  const operationsTransformedTotal = rewriteRecords.length;
  const untransformedOperations = analyzeUntransformedOperations({
    workspacePath,
    semanticResult,
    records,
    domainMutationOperationKeys,
  });
  const filesGenerated =
    generatedArtifacts.runtime.length +
    generatedArtifacts.sdk.length +
    generatedArtifacts.functions.length +
    generatedArtifacts.shared.length +
    generatedArtifacts.other.length;

  return {
    funimasVersion,
    date: finishedAt.toISOString(),
    duration,
    executionId,
    stats: {
      filesModified: fileChanges.length,
      codeChanges: rewriteRecords.length,
      filesGenerated,
      operationsTransformed: operationsTransformedTotal,
      operationsUntransformed: untransformedOperations.length,
    },
    fileChanges,
    generatedArtifacts,
    operationsFound: semanticResult.operationsByType,
    operationsTransformed,
    untransformedOperations,
    workspaceReady: untransformedOperations.every((finding) => !finding.blocking),
  };
}
