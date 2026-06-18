import type { SemanticResult } from '../semantic/SemanticResult.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';

import { PlannerContext } from './PlannerContext.js';
import {
  PlannerResult,
  createEmptyActionsByType,
} from './PlannerResult.js';
import { TransformationAction } from './TransformationAction.js';
import { TransformationPlan } from './TransformationPlan.js';
import type { ActionType } from './ActionType.js';

const EXECUTION_TIME_MS_BY_TYPE: Partial<Record<ActionType, number>> = {
  CREATE_BACKUP: 500,
  CREATE_WORKSPACE: 700,
  GENERATE_RUNTIME: 1200,
  GENERATE_FUNCTION: 800,
  GENERATE_SDK: 1000,
  REWRITE_CODE: 600,
  UPDATE_IMPORTS: 300,
  REMOVE_UNUSED_IMPORTS: 200,
  FORMAT_FILE: 150,
  VALIDATE_PROJECT: 900,
  GENERATE_REPORT: 400,
};

export interface TransformationPlannerService {
  plan(semanticResult: SemanticResult): PlannerResult;
}

export interface TransformationPlannerOptions {
  now?: () => Date;
}

/**
 * Motor de planificación que transforma operaciones semánticas en acciones ejecutables.
 * No modifica archivos: solo construye el plan para un futuro Executor.
 */
export class TransformationPlanner implements TransformationPlannerService {
  private readonly now: () => Date;

  constructor(options: TransformationPlannerOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  plan(semanticResult: SemanticResult): PlannerResult {
    const startedAt = this.now();
    const context = new PlannerContext(semanticResult);
    const plan = new TransformationPlan();

    this.addFoundationActions(plan);

    const provider = context.getProvider() ?? 'unknown';
    const transformableOperations = context.getTransformableOperations();
    const rewriteIdsByFile = new Map<string, string[]>();

    for (const operation of transformableOperations) {
      const runtimeActionId = this.ensureRuntimeAction(plan, provider);
      const sdkActionId = this.ensureSdkAction(plan, provider, runtimeActionId);
      const functionActionId = this.createFunctionAction(plan, operation, runtimeActionId, sdkActionId);
      const rewriteActionId = this.createRewriteAction(plan, operation, functionActionId);
      const fileRewrites = rewriteIdsByFile.get(operation.file) ?? [];

      fileRewrites.push(rewriteActionId);
      rewriteIdsByFile.set(operation.file, fileRewrites);
    }

    for (const [filePath, rewriteActionIds] of rewriteIdsByFile.entries()) {
      this.ensureImportActions(plan, filePath, rewriteActionIds);
    }

    this.addFinalizationActions(plan, [...rewriteIdsByFile.keys()]);

    const finishedAt = this.now();
    const actions = plan.getActions();

    return new PlannerResult({
      plan,
      totalActions: actions.length,
      actionsByType: this.countActionsByType(actions),
      estimatedModifiedFiles: rewriteIdsByFile.size,
      estimatedGeneratedFiles: this.countGeneratedFiles(actions),
      estimatedExecutionTime: this.estimateExecutionTime(actions),
      startedAt,
      finishedAt,
    });
  }

  private addFoundationActions(plan: TransformationPlan): void {
    plan.addAction(
      new TransformationAction({
        id: 'action-create-backup',
        type: 'CREATE_BACKUP',
        description: 'Crear backup del proyecto original',
        priority: 'CRITICAL',
        metadata: { phase: 'foundation' },
      }),
    );

    plan.addAction(
      new TransformationAction({
        id: 'action-create-workspace',
        type: 'CREATE_WORKSPACE',
        description: 'Crear workspace de trabajo',
        priority: 'CRITICAL',
        dependencies: ['action-create-backup'],
        metadata: { phase: 'foundation' },
      }),
    );
  }

  private ensureRuntimeAction(plan: TransformationPlan, provider: string): string {
    const actionId = `action-runtime-${provider}`;
    const existing = plan.findAction(actionId);

    if (existing) {
      return existing.id;
    }

    plan.addAction(
      new TransformationAction({
        id: actionId,
        type: 'GENERATE_RUNTIME',
        description: `Generar runtime para ${provider}`,
        priority: 'CRITICAL',
        dependencies: ['action-create-workspace'],
        metadata: { provider, phase: 'generation' },
      }),
    );

    return actionId;
  }

  private ensureSdkAction(
    plan: TransformationPlan,
    provider: string,
    runtimeActionId: string,
  ): string {
    const actionId = `action-sdk-${provider}`;
    const existing = plan.findAction(actionId);

    if (existing) {
      return existing.id;
    }

    plan.addAction(
      new TransformationAction({
        id: actionId,
        type: 'GENERATE_SDK',
        description: `Generar SDK para ${provider}`,
        priority: 'HIGH',
        dependencies: [runtimeActionId],
        metadata: { provider, phase: 'generation' },
      }),
    );

    return actionId;
  }

  private createFunctionAction(
    plan: TransformationPlan,
    operation: SemanticOperation,
    runtimeActionId: string,
    sdkActionId: string,
  ): string {
    const actionId = `action-function-${operation.id}`;

    plan.addAction(
      new TransformationAction({
        id: actionId,
        type: 'GENERATE_FUNCTION',
        description: `Generar function para ${operation.description}`,
        priority: 'HIGH',
        dependencies: [runtimeActionId, sdkActionId],
        metadata: {
          operationId: operation.id,
          operationType: operation.type,
          file: operation.file,
          line: operation.line,
          column: operation.column,
          provider: operation.metadata.provider,
          category: operation.metadata.category,
          callee: operation.metadata.callee,
        },
      }),
    );

    return actionId;
  }

  private createRewriteAction(
    plan: TransformationPlan,
    operation: SemanticOperation,
    functionActionId: string,
  ): string {
    const actionId = `action-rewrite-${operation.id}`;

    plan.addAction(
      new TransformationAction({
        id: actionId,
        type: 'REWRITE_CODE',
        description: `Reescribir llamada en ${operation.file}:${operation.line}`,
        priority: 'NORMAL',
        dependencies: [functionActionId],
        metadata: {
          operationId: operation.id,
          file: operation.file,
          line: operation.line,
          column: operation.column,
          operationType: operation.type,
        },
      }),
    );

    return actionId;
  }

  private ensureImportActions(
    plan: TransformationPlan,
    filePath: string,
    rewriteActionIds: string[],
  ): void {
    const updateImportsId = `action-update-imports-${this.normalizeFileKey(filePath)}`;

    if (!plan.findAction(updateImportsId)) {
      plan.addAction(
        new TransformationAction({
          id: updateImportsId,
          type: 'UPDATE_IMPORTS',
          description: `Actualizar imports en ${filePath}`,
          priority: 'NORMAL',
          dependencies: rewriteActionIds,
          metadata: { file: filePath },
        }),
      );
    }

    const removeImportsId = `action-remove-imports-${this.normalizeFileKey(filePath)}`;

    if (!plan.findAction(removeImportsId)) {
      plan.addAction(
        new TransformationAction({
          id: removeImportsId,
          type: 'REMOVE_UNUSED_IMPORTS',
          description: `Eliminar imports no usados en ${filePath}`,
          priority: 'LOW',
          dependencies: [updateImportsId],
          metadata: { file: filePath },
        }),
      );
    }

    const formatFileId = `action-format-${this.normalizeFileKey(filePath)}`;

    if (!plan.findAction(formatFileId)) {
      plan.addAction(
        new TransformationAction({
          id: formatFileId,
          type: 'FORMAT_FILE',
          description: `Formatear archivo ${filePath}`,
          priority: 'LOW',
          dependencies: [removeImportsId],
          metadata: { file: filePath },
        }),
      );
    }
  }

  private addFinalizationActions(plan: TransformationPlan, files: string[]): void {
    const formatDependencies = files.map((file) => `action-format-${this.normalizeFileKey(file)}`);
    const existingFormatActions = formatDependencies.filter((actionId) => plan.findAction(actionId));
    const validateDependencies =
      existingFormatActions.length > 0 ? existingFormatActions : ['action-create-workspace'];

    plan.addAction(
      new TransformationAction({
        id: 'action-validate-project',
        type: 'VALIDATE_PROJECT',
        description: 'Validar integridad del proyecto transformado',
        priority: 'HIGH',
        dependencies: validateDependencies,
        metadata: { phase: 'finalization' },
      }),
    );

    plan.addAction(
      new TransformationAction({
        id: 'action-generate-report',
        type: 'GENERATE_REPORT',
        description: 'Generar reporte de transformación',
        priority: 'NORMAL',
        dependencies: ['action-validate-project'],
        metadata: { phase: 'finalization' },
      }),
    );
  }

  private countActionsByType(actions: TransformationAction[]): Record<ActionType, number> {
    const counts = createEmptyActionsByType();

    for (const action of actions) {
      counts[action.type] += 1;
    }

    return counts;
  }

  private countGeneratedFiles(actions: TransformationAction[]): number {
    return actions.filter((action) =>
      ['GENERATE_RUNTIME', 'GENERATE_FUNCTION', 'GENERATE_SDK'].includes(action.type),
    ).length;
  }

  private estimateExecutionTime(actions: TransformationAction[]): number {
    return actions.reduce((total, action) => {
      return total + (EXECUTION_TIME_MS_BY_TYPE[action.type] ?? 250);
    }, 0);
  }

  private normalizeFileKey(filePath: string): string {
    return filePath.replace(/[^a-zA-Z0-9]+/g, '-');
  }
}
