import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TransformationRecord } from '../src/history/TransformationRecord.js';
import { buildChangeReportViewModel } from '../src/report/change-report-builder.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';

describe('buildChangeReportViewModel', () => {
  const workspacePath = '/tmp/demo_funimas';

  it('agrupa reescrituras por archivo y separa archivos generados', () => {
    const records = [
      new TransformationRecord({
        file: join(workspacePath, 'src/App.tsx'),
        operation: 'DATABASE_INSERT',
        rewriteRule: 'DatabaseInsertRewriteRule',
        before: 'addDoc(collection(db, "users"), data)',
        after: 'Funimas.database.insert("users", data)',
        generatedFiles: [],
        modifiedImports: [],
        status: 'COMPLETED',
        sourceLine: 12,
      }),
      new TransformationRecord({
        file: join(workspacePath, 'src/App.tsx'),
        operation: 'DATABASE_READ',
        rewriteRule: 'DatabaseReadRewriteRule',
        before: 'getDoc(doc(db, "users", id))',
        after: 'Funimas.database.get("users", id)',
        generatedFiles: [],
        modifiedImports: [],
        status: 'COMPLETED',
        sourceLine: 24,
      }),
      new TransformationRecord({
        file: join(workspacePath, 'runtime/router.ts'),
        operation: 'GENERATE_RUNTIME',
        rewriteRule: 'RuntimeGenerator',
        before: '',
        after: 'export const router = true;',
        generatedFiles: ['runtime/router.ts'],
        modifiedImports: [],
        status: 'COMPLETED',
      }),
      new TransformationRecord({
        file: join(workspacePath, 'sdk/index.ts'),
        operation: 'GENERATE_SDK',
        rewriteRule: 'SDKGenerator',
        before: '',
        after: 'export const Funimas = {};',
        generatedFiles: ['sdk/index.ts'],
        modifiedImports: [],
        status: 'COMPLETED',
      }),
    ];

    const semanticResult = new SemanticResult({
      operations: [],
      totalOperations: 0,
      operationsByType: {
        ...createEmptyActionsByType(),
        DATABASE_INSERT: 1,
        DATABASE_READ: 1,
      },
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const viewModel = buildChangeReportViewModel({
      workspacePath,
      records,
      semanticResult,
      duration: 900,
      finishedAt: new Date('2026-06-19T12:00:00.000Z'),
      funimasVersion: '0.1.0',
      executionId: 'exec-1',
    });

    expect(viewModel.fileChanges).toHaveLength(1);
    expect(viewModel.fileChanges[0]?.relativeFile).toBe('src/App.tsx');
    expect(viewModel.fileChanges[0]?.changes).toHaveLength(2);
    expect(viewModel.fileChanges[0]?.changes[0]?.sourceLine).toBe(12);
    expect(viewModel.generatedArtifacts.runtime).toEqual(['runtime/router.ts']);
    expect(viewModel.generatedArtifacts.sdk).toEqual(['sdk/index.ts']);
    expect(viewModel.stats.codeChanges).toBe(2);
    expect(viewModel.stats.filesGenerated).toBe(2);
  });
});
