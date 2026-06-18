import { ValidationContext } from './ValidationContext.js';
import type { ValidationError } from './ValidationError.js';
import { ValidationRegistry } from './ValidationRegistry.js';
import { ValidationResult, type RuleValidationResult } from './ValidationResult.js';
import { GeneratedFilesRule } from './rules/GeneratedFilesRule.js';
import { MissingFilesRule } from './rules/MissingFilesRule.js';
import { MissingImportsRule } from './rules/MissingImportsRule.js';
import { RuntimeStructureRule } from './rules/RuntimeStructureRule.js';
import { SDKStructureRule } from './rules/SDKStructureRule.js';
import { TypeScriptCompilationRule } from './rules/TypeScriptCompilationRule.js';

export interface ValidationEngineOptions {
  registry?: ValidationRegistry;
  now?: () => Date;
}

export interface ValidationEngineService {
  validate(workspacePath: string, context?: Partial<ValidationContext>): Promise<ValidationResult>;
  validateContext(context: ValidationContext): Promise<ValidationResult>;
}

export class ValidationEngine implements ValidationEngineService {
  private readonly registry: ValidationRegistry;
  private readonly now: () => Date;

  constructor(options: ValidationEngineOptions = {}) {
    this.registry = options.registry ?? createDefaultValidationRegistry();
    this.now = options.now ?? (() => new Date());
  }

  async validate(
    workspacePath: string,
    context: Partial<ValidationContext> = {},
  ): Promise<ValidationResult> {
    return this.validateContext(
      new ValidationContext({
        projectPath: context.projectPath ?? workspacePath,
        workspacePath,
        history: context.history,
        semanticResult: context.semanticResult,
      }),
    );
  }

  async validateContext(context: ValidationContext): Promise<ValidationResult> {
    const startedAt = this.now();
    const ruleResults: RuleValidationResult[] = [];
    const errors: ValidationError[] = [];
    const failedTransformationIds = new Set<string>();

    for (const rule of this.registry.getRules()) {
      const ruleStartedAt = this.now();
      const result = await rule.validate(context);
      const ruleFinishedAt = this.now();

      ruleResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        passed: result.passed,
        duration: ruleFinishedAt.getTime() - ruleStartedAt.getTime(),
        filesEvaluated: result.filesEvaluated,
        errors: result.errors,
      });

      for (const error of result.errors) {
        errors.push(error);

        if (error.transformationId) {
          failedTransformationIds.add(error.transformationId);
        }
      }
    }

    const finishedAt = this.now();

    return new ValidationResult({
      valid: errors.length === 0,
      ruleResults,
      errors,
      failedTransformationIds: [...failedTransformationIds],
      rolledBackTransformationIds: [],
      startedAt,
      finishedAt,
    });
  }
}

export function createDefaultValidationRegistry(): ValidationRegistry {
  const registry = new ValidationRegistry();

  registry.registerMany([
    new TypeScriptCompilationRule(),
    new MissingImportsRule(),
    new MissingFilesRule(),
    new GeneratedFilesRule(),
    new RuntimeStructureRule(),
    new SDKStructureRule(),
  ]);

  return registry;
}
