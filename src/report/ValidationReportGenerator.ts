import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ValidationResult } from '../validation/ValidationResult.js';
import type { RollbackResult } from '../rollback/RollbackResult.js';
import { RuntimeTemplateEngine } from '../runtime/RuntimeTemplateEngine.js';
import { VERSION } from '../utils/version.js';

export interface ValidationReportSummary {
  valid: boolean;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  totalErrors: number;
  duration: number;
  date: string;
  funimasVersion: string;
  executionId: string;
  rolledBackTransformations: string[];
}

export interface ValidationReportResult {
  markdownPath: string;
  htmlPath: string;
  jsonPath: string;
  summary: ValidationReportSummary;
}

export interface ValidationReportGeneratorOptions {
  templateEngine?: RuntimeTemplateEngine;
}

export class ValidationReportGenerator {
  private readonly templateEngine: RuntimeTemplateEngine;

  constructor(options: ValidationReportGeneratorOptions = {}) {
    this.templateEngine = options.templateEngine ?? new RuntimeTemplateEngine();
  }

  async generate(
    workspacePath: string,
    validationResult: ValidationResult,
    rollbackResults: RollbackResult[],
    executionId: string,
    finishedAt: Date,
  ): Promise<ValidationReportResult> {
    const reportDir = join(workspacePath, '.funimas', 'reports');
    await mkdir(reportDir, { recursive: true });

    const rolledBackTransformations = rollbackResults
      .filter((result) => result.success)
      .map((result) => result.transformationId);

    const ruleResults = validationResult.ruleResults.map((ruleResult) => ({
      ...ruleResult,
      errors: ruleResult.errors.map((error) => error.toJSON()),
      rolledBack: ruleResult.errors.some((error) =>
        error.transformationId
          ? rolledBackTransformations.includes(error.transformationId)
          : false,
      ),
    }));

    const summary: ValidationReportSummary = {
      valid: validationResult.valid,
      totalRules: validationResult.ruleResults.length,
      passedRules: validationResult.ruleResults.filter((rule) => rule.passed).length,
      failedRules: validationResult.ruleResults.filter((rule) => !rule.passed).length,
      totalErrors: validationResult.errors.length,
      duration: validationResult.duration,
      date: finishedAt.toISOString(),
      funimasVersion: VERSION,
      executionId,
      rolledBackTransformations,
    };

    const templateData = {
      summary,
      ruleResults,
      errors: validationResult.errors.map((error) => error.toJSON()),
      rollbackResults: rollbackResults.map((result) => ({
        transformationId: result.transformationId,
        success: result.success,
        reason: result.reason,
        actions: result.actions.map((action) => action.toJSON()),
        duration: result.duration,
      })),
      funimasVersion: VERSION,
    };

    const markdown = await this.templateEngine.render('reports/validation.md.hbs', templateData);
    const html = await this.templateEngine.render('reports/validation.html.hbs', templateData);
    const json = await this.templateEngine.render('reports/validation.json.hbs', {
      ...summary,
      ruleResults,
      errors: validationResult.errors.map((error) => error.toJSON()),
      rollbackResults: templateData.rollbackResults,
    } as Record<string, unknown>);

    const markdownPath = join(reportDir, 'validation.md');
    const htmlPath = join(reportDir, 'validation.html');
    const jsonPath = join(reportDir, 'validation.json');

    await writeFile(markdownPath, `${markdown}\n`, 'utf8');
    await writeFile(htmlPath, `${html}\n`, 'utf8');
    await writeFile(jsonPath, `${json}\n`, 'utf8');

    return {
      markdownPath,
      htmlPath,
      jsonPath,
      summary,
    };
  }
}
