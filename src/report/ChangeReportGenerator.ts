import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';

import type { SemanticResult } from '../semantic/SemanticResult.js';
import { TransformationHistory } from '../history/TransformationHistory.js';
import { RuntimeTemplateEngine } from '../runtime/RuntimeTemplateEngine.js';
import { VERSION } from '../utils/version.js';

export interface ChangeReportSummary {
  modifiedFiles: string[];
  generatedFiles: string[];
  operationsFound: Record<string, number>;
  operationsTransformed: Record<string, number>;
  duration: number;
  date: string;
  funimasVersion: string;
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
  ): Promise<ChangeReportResult> {
    const records = history.getRecords();
    const reportDir = join(workspacePath, '.funimas', 'reports');

    await mkdir(reportDir, { recursive: true });

    const reportRecords = records
      .filter((record) => record.before.length > 0 || record.after.length > 0)
      .map((record) => ({
        relativeFile: this.toWorkspaceRelativePath(workspacePath, record.file),
        before: record.before,
        after: record.after,
        rewriteRule: record.rewriteRule,
        operation: record.operation,
      }));

    const modifiedFiles = [
      ...new Set(
        records
          .filter((record) => record.before.length > 0)
          .map((record) => this.toWorkspaceRelativePath(workspacePath, record.file)),
      ),
    ];

    const generatedFiles = [
      ...new Set(records.flatMap((record) => record.generatedFiles)),
    ];

    const operationsFound = semanticResult.operationsByType;
    const operationsTransformed = records.reduce<Record<string, number>>((counts, record) => {
      if (record.before.length > 0) {
        counts[record.operation] = (counts[record.operation] ?? 0) + 1;
      }

      return counts;
    }, {});

    const summary: ChangeReportSummary = {
      modifiedFiles,
      generatedFiles,
      operationsFound,
      operationsTransformed,
      duration,
      date: finishedAt.toISOString(),
      funimasVersion: VERSION,
    };

    const markdown = await this.templateEngine.render('reports/changes.md.hbs', {
      records: reportRecords,
    });
    const html = await this.templateEngine.render('reports/changes.html.hbs', {
      records: reportRecords,
    });
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

  private toWorkspaceRelativePath(workspacePath: string, filePath: string): string {
    const workspaceRoot = resolve(workspacePath);

    if (filePath.startsWith(workspaceRoot)) {
      return relative(workspaceRoot, filePath);
    }

    return basename(filePath);
  }
}
