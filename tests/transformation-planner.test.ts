import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GraphBuilder } from '../src/graph/GraphBuilder.js';
import { ACTION_TYPE_ORDER } from '../src/planner/ActionType.js';
import { ActionDependencyResolver } from '../src/planner/ActionDependencyResolver.js';
import { TransformationPlanner } from '../src/planner/TransformationPlanner.js';
import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';
import { SemanticAnalyzer } from '../src/semantic/SemanticAnalyzer.js';
import { SemanticOperation } from '../src/semantic/SemanticOperation.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';
import { TransformationAction } from '../src/planner/TransformationAction.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const firebaseProjectPath = join(fixturesDir, 'firebase-project');

async function planFirebaseProject() {
  const parser = new AstParser();
  const scanner = new ProjectScanner();
  const graphBuilder = new GraphBuilder();
  const semanticAnalyzer = new SemanticAnalyzer();
  const planner = new TransformationPlanner({
    now: () => new Date(2026, 5, 18, 14, 35, 22),
  });

  const parseResult = await parser.parse(firebaseProjectPath);
  const scanResult = await scanner.scan(parseResult.project);
  const graphResult = graphBuilder.build(scanResult);
  const semanticResult = await semanticAnalyzer.analyze(graphResult);

  return planner.plan(semanticResult);
}

describe('TransformationPlanner', () => {
  it('genera un plan completo a partir del SemanticResult', async () => {
    const result = await planFirebaseProject();

    expect(result.totalActions).toBeGreaterThan(0);
    expect(result.getActionsByType('CREATE_BACKUP')).toHaveLength(1);
    expect(result.getActionsByType('CREATE_WORKSPACE')).toHaveLength(1);
    expect(result.getActionsByType('GENERATE_RUNTIME')).toHaveLength(1);
    expect(result.getActionsByType('GENERATE_SDK')).toHaveLength(1);
    expect(result.getActionsByType('GENERATE_FUNCTION').length).toBe(11);
    expect(result.getActionsByType('REWRITE_CODE').length).toBe(11);
    expect(result.getActionsByType('UPDATE_IMPORTS').length).toBe(3);
    expect(result.getActionsByType('VALIDATE_PROJECT')).toHaveLength(1);
    expect(result.getActionsByType('GENERATE_REPORT')).toHaveLength(1);
    expect(result.estimatedModifiedFiles).toBe(3);
    expect(result.estimatedGeneratedFiles).toBe(13);
    expect(result.estimatedExecutionTime).toBeGreaterThan(0);
    expect(result.duration).toBe(0);
  });

  it('ordena las acciones respetando dependencias y tipos', async () => {
    const result = await planFirebaseProject();
    const orderedActions = result.getOrderedActions();
    const positions = new Map(orderedActions.map((action, index) => [action.id, index]));

    const backup = orderedActions.find((action) => action.type === 'CREATE_BACKUP');
    const runtime = orderedActions.find((action) => action.type === 'GENERATE_RUNTIME');
    const sdk = orderedActions.find((action) => action.type === 'GENERATE_SDK');
    const rewrite = orderedActions.find((action) => action.type === 'REWRITE_CODE');
    const validate = orderedActions.find((action) => action.type === 'VALIDATE_PROJECT');
    const report = orderedActions.find((action) => action.type === 'GENERATE_REPORT');

    expect(backup).toBeDefined();
    expect(runtime).toBeDefined();
    expect(sdk).toBeDefined();
    expect(rewrite).toBeDefined();
    expect(validate).toBeDefined();
    expect(report).toBeDefined();

    expect(positions.get(backup!.id)! < positions.get(runtime!.id)!).toBe(true);
    expect(positions.get(runtime!.id)! < positions.get(sdk!.id)!).toBe(true);
    expect(positions.get(sdk!.id)! < positions.get(rewrite!.id)!).toBe(true);
    expect(positions.get(validate!.id)! < positions.get(report!.id)!).toBe(true);
  });

  it('asigna prioridades coherentes a las acciones críticas', async () => {
    const result = await planFirebaseProject();

    expect(result.getActionsByType('CREATE_BACKUP')[0]?.priority).toBe('CRITICAL');
    expect(result.getActionsByType('GENERATE_RUNTIME')[0]?.priority).toBe('CRITICAL');
    expect(result.getActionsByType('GENERATE_FUNCTION')[0]?.priority).toBe('HIGH');
    expect(result.getActionsByType('FORMAT_FILE')[0]?.priority).toBe('LOW');
  });
});

describe('ActionDependencyResolver', () => {
  it('reordena acciones desordenadas según dependencias implícitas', () => {
    const resolver = new ActionDependencyResolver();
    const actions = [
      new TransformationAction({
        id: 'sdk',
        type: 'GENERATE_SDK',
        description: 'SDK',
        priority: 'NORMAL',
      }),
      new TransformationAction({
        id: 'backup',
        type: 'CREATE_BACKUP',
        description: 'Backup',
        priority: 'NORMAL',
      }),
      new TransformationAction({
        id: 'format',
        type: 'FORMAT_FILE',
        description: 'Format',
        priority: 'LOW',
      }),
    ];

    const ordered = resolver.resolve(actions);

    expect(ordered.map((action) => action.id)).toEqual(['backup', 'sdk', 'format']);
    expect(
      ACTION_TYPE_ORDER[ordered[0]!.type] <= ACTION_TYPE_ORDER[ordered[1]!.type],
    ).toBe(true);
  });
});

describe('TransformationPlan', () => {
  it('permite agregar, buscar, eliminar y exportar acciones', () => {
    const planner = new TransformationPlanner();
    const semanticResult = new SemanticResult({
      operations: [
        new SemanticOperation({
          type: 'DATABASE_INSERT',
          file: '/tmp/project/src/data.ts',
          line: 10,
          column: 3,
          description: 'addDoc',
          metadata: { provider: 'firebase', category: 'firestore', callee: 'addDoc' },
        }),
      ],
      totalOperations: 1,
      operationsByType: {
        ...createEmptyActionsByType(),
        DATABASE_INSERT: 1,
      },
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const result = planner.plan(semanticResult);
    const plan = result.plan;
    const firstAction = plan.getActions()[0];

    expect(plan.findAction(firstAction!.id)).toBeDefined();
    expect(plan.export().orderedActionIds.length).toBe(result.totalActions);
    expect(plan.removeAction(firstAction!.id)).toBe(true);
    expect(plan.findAction(firstAction!.id)).toBeUndefined();
  });
});
