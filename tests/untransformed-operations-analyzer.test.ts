import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TransformationRecord } from '../src/history/TransformationRecord.js';
import { analyzeUntransformedOperations } from '../src/report/untransformed-operations-analyzer.js';
import { SemanticOperation } from '../src/semantic/SemanticOperation.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';

describe('analyzeUntransformedOperations', () => {
  const workspacePath = '/tmp/demo_funimas';

  it('marca APIs no soportadas como bloqueantes', () => {
    const semanticResult = new SemanticResult({
      operations: [
        new SemanticOperation({
          type: 'CUSTOM',
          file: join(workspacePath, 'src/App.tsx'),
          line: 10,
          column: 1,
          description: 'runTransaction',
          metadata: {
            category: 'firestore',
            callee: 'runTransaction',
            supported: false,
          },
        }),
      ],
      totalOperations: 1,
      operationsByType: { ...createEmptyActionsByType(), CUSTOM: 1 },
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const findings = analyzeUntransformedOperations({
      workspacePath,
      semanticResult,
      records: [],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.reason).toBe('unsupported-api');
    expect(findings[0]?.blocking).toBe(true);
    expect(findings[0]?.file).toBe('src/App.tsx');
  });

  it('detecta operaciones Firestore soportadas que no se reescribieron', () => {
    const semanticResult = new SemanticResult({
      operations: [
        new SemanticOperation({
          type: 'DATABASE_READ',
          file: join(workspacePath, 'src/App.tsx'),
          line: 20,
          column: 1,
          description: 'getDoc',
          metadata: {
            category: 'firestore',
            callee: 'getDoc',
            supported: true,
          },
        }),
      ],
      totalOperations: 1,
      operationsByType: { ...createEmptyActionsByType(), DATABASE_READ: 1 },
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const findings = analyzeUntransformedOperations({
      workspacePath,
      semanticResult,
      records: [],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.reason).toBe('not-transformed');
    expect(findings[0]?.callee).toBe('getDoc');
    expect(findings[0]?.blocking).toBe(false);
  });

  it('ignora operaciones ya transformadas según el historial', () => {
    const semanticResult = new SemanticResult({
      operations: [
        new SemanticOperation({
          type: 'DATABASE_READ',
          file: join(workspacePath, 'src/App.tsx'),
          line: 20,
          column: 1,
          description: 'getDoc',
          metadata: {
            category: 'firestore',
            callee: 'getDoc',
            supported: true,
          },
        }),
      ],
      totalOperations: 1,
      operationsByType: { ...createEmptyActionsByType(), DATABASE_READ: 1 },
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const records = [
      new TransformationRecord({
        file: join(workspacePath, 'src/App.tsx'),
        operation: 'DATABASE_READ',
        rewriteRule: 'DatabaseReadRewriteRule',
        before: 'getDoc(doc(db, "users", id))',
        after: 'Funimas.database.get("users", id)',
        generatedFiles: [],
        modifiedImports: [],
        status: 'COMPLETED',
        sourceLine: 20,
      }),
    ];

    const findings = analyzeUntransformedOperations({
      workspacePath,
      semanticResult,
      records,
    });

    expect(findings).toHaveLength(0);
  });

  it('ignora operaciones en archivos generados por Funimas', () => {
    const semanticResult = new SemanticResult({
      operations: [
        new SemanticOperation({
          type: 'CUSTOM',
          file: join(workspacePath, 'runtime/repositories/firestoreRepository.ts'),
          line: 93,
          column: 1,
          description: 'runTransaction',
          metadata: {
            category: 'firestore',
            callee: 'runTransaction',
            supported: false,
          },
        }),
      ],
      totalOperations: 1,
      operationsByType: { ...createEmptyActionsByType(), CUSTOM: 1 },
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const findings = analyzeUntransformedOperations({
      workspacePath,
      semanticResult,
      records: [],
    });

    expect(findings).toHaveLength(0);
  });
});
