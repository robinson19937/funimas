import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GraphBuilder } from '../src/graph/GraphBuilder.js';
import { ACTION_PRIORITIES } from '../src/planner/ActionPriority.js';
import { ACTION_TYPE_ORDER } from '../src/planner/ActionType.js';
import { ActionDependencyResolver } from '../src/planner/ActionDependencyResolver.js';
import { ActionGraph } from '../src/planner/ActionGraph.js';
import { PlannerContext } from '../src/planner/PlannerContext.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';
import { TransformationAction } from '../src/planner/TransformationAction.js';
import { TransformationPlanner } from '../src/planner/TransformationPlanner.js';
import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';
import { SemanticAnalyzer } from '../src/semantic/SemanticAnalyzer.js';
import { SemanticOperation } from '../src/semantic/SemanticOperation.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';

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

function createSemanticResult(operations: SemanticOperation[]): SemanticResult {
  const operationsByType = createEmptyActionsByType();

  for (const operation of operations) {
    operationsByType[operation.type] += 1;
  }

  return new SemanticResult({
    operations,
    totalOperations: operations.length,
    operationsByType,
    startedAt: new Date('2026-06-18T14:00:00.000Z'),
    finishedAt: new Date('2026-06-18T14:00:01.000Z'),
  });
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
    const workspace = orderedActions.find((action) => action.type === 'CREATE_WORKSPACE');
    const runtime = orderedActions.find((action) => action.type === 'GENERATE_RUNTIME');
    const sdk = orderedActions.find((action) => action.type === 'GENERATE_SDK');
    const rewrite = orderedActions.find((action) => action.type === 'REWRITE_CODE');
    const validate = orderedActions.find((action) => action.type === 'VALIDATE_PROJECT');
    const report = orderedActions.find((action) => action.type === 'GENERATE_REPORT');

    expect(backup).toBeDefined();
    expect(workspace).toBeDefined();
    expect(runtime).toBeDefined();
    expect(sdk).toBeDefined();
    expect(rewrite).toBeDefined();
    expect(validate).toBeDefined();
    expect(report).toBeDefined();

    expect(positions.get(backup!.id)! < positions.get(workspace!.id)!).toBe(true);
    expect(positions.get(workspace!.id)! < positions.get(runtime!.id)!).toBe(true);
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

  it('reutiliza acciones compartidas de runtime y sdk por proveedor', () => {
    const planner = new TransformationPlanner();
    const semanticResult = createSemanticResult([
      new SemanticOperation({
        type: 'DATABASE_INSERT',
        file: '/tmp/a.ts',
        line: 1,
        column: 1,
        description: 'addDoc',
        metadata: { provider: 'firebase', category: 'firestore' },
      }),
      new SemanticOperation({
        type: 'DATABASE_READ',
        file: '/tmp/b.ts',
        line: 2,
        column: 1,
        description: 'getDoc',
        metadata: { provider: 'firebase', category: 'firestore' },
      }),
    ]);

    const result = planner.plan(semanticResult);

    expect(result.getActionsByType('GENERATE_RUNTIME')).toHaveLength(1);
    expect(result.getActionsByType('GENERATE_SDK')).toHaveLength(1);
    expect(result.getActionsByType('GENERATE_FUNCTION')).toHaveLength(2);
  });

  it('genera plan mínimo cuando no hay operaciones transformables', () => {
    const planner = new TransformationPlanner();
    const semanticResult = createSemanticResult([
      new SemanticOperation({
        type: 'CUSTOM',
        file: '/tmp/imports.ts',
        line: 1,
        column: 1,
        description: 'import firebase',
        metadata: { provider: 'firebase', category: 'import' },
      }),
    ]);

    const result = planner.plan(semanticResult);

    expect(result.getActionsByType('GENERATE_FUNCTION')).toHaveLength(0);
    expect(result.getActionsByType('REWRITE_CODE')).toHaveLength(0);
    expect(result.getActionsByType('VALIDATE_PROJECT')).toHaveLength(1);
    expect(result.getActionsByType('GENERATE_REPORT')).toHaveLength(1);
  });
});

describe('PlannerContext', () => {
  it('filtra operaciones transformables y detecta el proveedor', () => {
    const semanticResult = createSemanticResult([
      new SemanticOperation({
        type: 'CUSTOM',
        file: '/tmp/import.ts',
        line: 1,
        column: 1,
        description: 'import',
        metadata: { provider: 'firebase', category: 'import' },
      }),
      new SemanticOperation({
        type: 'DATABASE_INSERT',
        file: '/tmp/data.ts',
        line: 2,
        column: 1,
        description: 'addDoc',
        metadata: { provider: 'firebase', category: 'firestore' },
      }),
    ]);
    const context = new PlannerContext(semanticResult);

    expect(context.getTransformableOperations()).toHaveLength(1);
    expect(context.getProvider()).toBe('firebase');
  });

  it('devuelve undefined cuando no hay proveedor', () => {
    const context = new PlannerContext(createSemanticResult([]));

    expect(context.getProvider()).toBeUndefined();
  });
});

describe('ActionGraph', () => {
  it('registra dependencias y dependientes', () => {
    const graph = new ActionGraph();
    const backup = new TransformationAction({
      id: 'backup',
      type: 'CREATE_BACKUP',
      description: 'Backup',
      priority: 'CRITICAL',
    });
    const runtime = new TransformationAction({
      id: 'runtime',
      type: 'GENERATE_RUNTIME',
      description: 'Runtime',
      priority: 'HIGH',
      dependencies: ['backup'],
    });

    graph.addAction(backup);
    graph.addAction(runtime);

    expect(graph.getActions()).toHaveLength(2);
    expect(graph.getDependencies('runtime')).toEqual(['backup']);
    expect(graph.getDependents('backup')).toEqual(['runtime']);
    expect(graph.getAction('missing')).toBeUndefined();
    expect(graph.getDependencies('missing')).toEqual([]);
    expect(graph.getDependents('missing')).toEqual([]);
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

  it('resuelve el orden completo esperado del pipeline', () => {
    const resolver = new ActionDependencyResolver();
    const actions = [
      new TransformationAction({
        id: 'sdk',
        type: 'GENERATE_SDK',
        description: 'SDK',
        priority: 'HIGH',
        dependencies: ['runtime'],
      }),
      new TransformationAction({
        id: 'format',
        type: 'FORMAT_FILE',
        description: 'Format',
        priority: 'LOW',
        dependencies: ['remove-imports'],
      }),
      new TransformationAction({
        id: 'backup',
        type: 'CREATE_BACKUP',
        description: 'Backup',
        priority: 'CRITICAL',
      }),
      new TransformationAction({
        id: 'workspace',
        type: 'CREATE_WORKSPACE',
        description: 'Workspace',
        priority: 'CRITICAL',
        dependencies: ['backup'],
      }),
      new TransformationAction({
        id: 'runtime',
        type: 'GENERATE_RUNTIME',
        description: 'Runtime',
        priority: 'CRITICAL',
        dependencies: ['workspace'],
      }),
      new TransformationAction({
        id: 'function',
        type: 'GENERATE_FUNCTION',
        description: 'Function',
        priority: 'HIGH',
        dependencies: ['runtime', 'sdk'],
      }),
      new TransformationAction({
        id: 'rewrite',
        type: 'REWRITE_CODE',
        description: 'Rewrite',
        priority: 'NORMAL',
        dependencies: ['function'],
      }),
      new TransformationAction({
        id: 'imports',
        type: 'UPDATE_IMPORTS',
        description: 'Imports',
        priority: 'NORMAL',
        dependencies: ['rewrite'],
      }),
      new TransformationAction({
        id: 'remove-imports',
        type: 'REMOVE_UNUSED_IMPORTS',
        description: 'Remove imports',
        priority: 'LOW',
        dependencies: ['imports'],
      }),
      new TransformationAction({
        id: 'validate',
        type: 'VALIDATE_PROJECT',
        description: 'Validate',
        priority: 'HIGH',
        dependencies: ['format'],
      }),
      new TransformationAction({
        id: 'report',
        type: 'GENERATE_REPORT',
        description: 'Report',
        priority: 'NORMAL',
        dependencies: ['validate'],
      }),
    ];

    const ordered = resolver.resolve(actions);

    expect(ordered.map((action) => action.type)).toEqual([
      'CREATE_BACKUP',
      'CREATE_WORKSPACE',
      'GENERATE_RUNTIME',
      'GENERATE_SDK',
      'GENERATE_FUNCTION',
      'REWRITE_CODE',
      'UPDATE_IMPORTS',
      'REMOVE_UNUSED_IMPORTS',
      'FORMAT_FILE',
      'VALIDATE_PROJECT',
      'GENERATE_REPORT',
    ]);
  });

  it('agrega acciones restantes cuando hay dependencias circulares', () => {
    const resolver = new ActionDependencyResolver();
    const actions = [
      new TransformationAction({
        id: 'action-b',
        type: 'REWRITE_CODE',
        description: 'Rewrite B',
        priority: 'NORMAL',
        dependencies: ['action-a'],
      }),
      new TransformationAction({
        id: 'action-a',
        type: 'UPDATE_IMPORTS',
        description: 'Imports A',
        priority: 'NORMAL',
        dependencies: ['action-b'],
      }),
    ];

    const ordered = resolver.resolve(actions);

    expect(ordered).toHaveLength(2);
    expect(ordered.map((action) => action.id)).toEqual(['action-b', 'action-a']);
  });

  it('desempata acciones del mismo tipo y prioridad por id', () => {
    const resolver = new ActionDependencyResolver();
    const actions = [
      new TransformationAction({
        id: 'action-z',
        type: 'FORMAT_FILE',
        description: 'Format Z',
        priority: 'LOW',
      }),
      new TransformationAction({
        id: 'action-a',
        type: 'FORMAT_FILE',
        description: 'Format A',
        priority: 'LOW',
      }),
    ];

    const ordered = resolver.resolve(actions);

    expect(ordered.map((action) => action.id)).toEqual(['action-a', 'action-z']);
  });

  it('agrega acciones restantes cuando existen dependencias inválidas', () => {
    const resolver = new ActionDependencyResolver();
    const actions = [
      new TransformationAction({
        id: 'rewrite',
        type: 'REWRITE_CODE',
        description: 'Rewrite',
        priority: 'NORMAL',
        dependencies: ['missing-action'],
      }),
      new TransformationAction({
        id: 'backup',
        type: 'CREATE_BACKUP',
        description: 'Backup',
        priority: 'CRITICAL',
      }),
    ];

    const ordered = resolver.resolve(actions);

    expect(ordered).toHaveLength(2);
    expect(ordered[0]?.type).toBe('CREATE_BACKUP');
  });
});

describe('TransformationPlan', () => {
  it('permite agregar, buscar, eliminar, ordenar y exportar acciones', () => {
    const planner = new TransformationPlanner();
    const semanticResult = createSemanticResult([
      new SemanticOperation({
        type: 'DATABASE_INSERT',
        file: '/tmp/project/src/data.ts',
        line: 10,
        column: 3,
        description: 'addDoc',
        metadata: { provider: 'firebase', category: 'firestore', callee: 'addDoc' },
      }),
    ]);

    const result = planner.plan(semanticResult);
    const plan = result.plan;
    const firstAction = plan.getActions()[0]!;
    const exported = plan.export();

    expect(plan.findAction(firstAction.id)).toBeDefined();
    expect(exported.actions.length).toBe(result.totalActions);
    expect(exported.orderedActionIds.length).toBe(result.totalActions);
    expect(plan.sortByPriority()[0]?.priority).toBe('CRITICAL');
    expect(plan.resolveDependencies().length).toBe(result.totalActions);
    expect(plan.removeAction(firstAction.id)).toBe(true);
    expect(plan.findAction(firstAction.id)).toBeUndefined();
    expect(plan.removeAction('missing')).toBe(false);
  });
});

describe('PlannerResult', () => {
  it('expone operaciones por tipo y duración', async () => {
    const result = await planFirebaseProject();

    expect(result.getActionsByType('GENERATE_RUNTIME')[0]?.type).toBe('GENERATE_RUNTIME');
    expect(ACTION_PRIORITIES).toContain(result.getActionsByType('CREATE_BACKUP')[0]?.priority);
  });
});

describe('TransformationAction', () => {
  it('permite definir un identificador personalizado y estado inicial', () => {
    const action = new TransformationAction({
      id: 'custom-action',
      type: 'VALIDATE_PROJECT',
      description: 'Validar',
      priority: 'HIGH',
      status: 'PENDING',
    });

    expect(action.id).toBe('custom-action');
    expect(action.status).toBe('PENDING');
    expect(action.dependencies).toEqual([]);
  });

  it('genera id y metadata por defecto cuando no se proporcionan', () => {
    const action = new TransformationAction({
      type: 'FORMAT_FILE',
      description: 'Formatear',
      priority: 'LOW',
    });

    expect(action.id.length).toBeGreaterThan(0);
    expect(action.metadata).toEqual({});
    expect(action.dependencies).toEqual([]);
    expect(action.status).toBe('PENDING');
  });
});
