import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SemanticResult } from '../semantic/SemanticResult.js';
import { TransformationHistory } from '../history/TransformationHistory.js';
import { RuntimeTemplateEngine } from '../runtime/RuntimeTemplateEngine.js';
import { VERSION } from '../utils/version.js';
import { buildChangeReportViewModel } from './change-report-builder.js';

export interface ChangeReportSummary {
  modifiedFiles: string[];
  generatedFiles: string[];
  operationsFound: Record<string, number>;
  operationsTransformed: Record<string, number>;
  duration: number;
  date: string;
  funimasVersion: string;
  totalBenefits: number;
  totalReasons: number;
  generatedFunctions: string[];
  generatedRuntimeFiles: string[];
  generatedSDKFiles: string[];
  compilerVersion: string;
  executionId: string;
  codeChanges: number;
  filesGenerated: number;
  operationsUntransformed: number;
  workspaceReady: boolean;
}

export interface ChangeReportResult {
  markdownPath: string;
  htmlPath: string;
  summaryPath: string;
  summary: ChangeReportSummary;
}

export interface ChangeReportGeneratorOptions {
  templateEngine?: RuntimeTemplateEngine;
}

export class ChangeReportGenerator {
  private readonly templateEngine: RuntimeTemplateEngine;

  constructor(options: ChangeReportGeneratorOptions = {}) {
    this.templateEngine = options.templateEngine ?? new RuntimeTemplateEngine();
  }

  async generate(
    workspacePath: string,
    history: TransformationHistory,
    semanticResult: SemanticResult,
    duration: number,
    finishedAt: Date,
    executionId: string = randomUUID(),
  ): Promise<ChangeReportResult> {
    const records = history.getRecords();
    const reportDir = join(workspacePath, '.funimas', 'reports');

    await mkdir(reportDir, { recursive: true });

    const viewModel = buildChangeReportViewModel({
      workspacePath,
      records,
      semanticResult,
      duration,
      finishedAt,
      funimasVersion: VERSION,
      executionId,
    });

    const modifiedFiles = viewModel.fileChanges.map((group) => group.relativeFile);
    const generatedFiles = [
      ...new Set([
        ...viewModel.generatedArtifacts.runtime,
        ...viewModel.generatedArtifacts.sdk,
        ...viewModel.generatedArtifacts.functions,
        ...viewModel.generatedArtifacts.shared,
        ...viewModel.generatedArtifacts.other,
        ...records
          .filter((record) => record.before.length > 0)
          .flatMap((record) => record.generatedFiles),
      ]),
    ];

    const totalReasons = records.filter((record) => record.reason.length > 0).length;
    const totalBenefits = records.filter((record) => record.benefit.length > 0).length;

    const relatedFunctionFiles = records
      .filter((record) => record.before.length > 0)
      .flatMap((record) => record.generatedFiles)
      .filter((file) => file.startsWith('netlify/functions/'));

    const summary: ChangeReportSummary = {
      modifiedFiles,
      generatedFiles,
      operationsFound: viewModel.operationsFound,
      operationsTransformed: viewModel.operationsTransformed,
      duration,
      date: finishedAt.toISOString(),
      funimasVersion: VERSION,
      totalBenefits,
      totalReasons,
      generatedFunctions: [
        ...new Set([...viewModel.generatedArtifacts.functions, ...relatedFunctionFiles]),
      ],
      generatedRuntimeFiles: viewModel.generatedArtifacts.runtime,
      generatedSDKFiles: viewModel.generatedArtifacts.sdk,
      compilerVersion: VERSION,
      executionId,
      codeChanges: viewModel.stats.codeChanges,
      filesGenerated: viewModel.stats.filesGenerated,
      operationsUntransformed: viewModel.stats.operationsUntransformed,
      workspaceReady: viewModel.workspaceReady,
    };

    const markdown = await this.templateEngine.render(
      'reports/changes.md.hbs',
      viewModel as unknown as Record<string, unknown>,
    );
    const html = await this.templateEngine.render(
      'reports/changes.html.hbs',
      viewModel as unknown as Record<string, unknown>,
    );
    const summaryJson = await this.templateEngine.render('reports/summary.json.hbs', {
      ...summary,
    } as Record<string, unknown>);

    const markdownPath = join(reportDir, 'changes.md');
    const htmlPath = join(reportDir, 'changes.html');
    const summaryPath = join(reportDir, 'summary.json');

    await writeFile(markdownPath, `${markdown}\n`, 'utf8');
    await writeFile(htmlPath, `${html}\n`, 'utf8');
    await writeFile(summaryPath, `${summaryJson}\n`, 'utf8');

    return {
      markdownPath,
      htmlPath,
      summaryPath,
      summary,
    };
  }
}
