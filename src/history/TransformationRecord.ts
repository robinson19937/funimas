import { randomUUID } from 'node:crypto';

import type { RiskLevel } from '../report/RiskLevel.js';
import { VERSION } from '../utils/version.js';

export const TRANSFORMATION_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;

export type TransformationStatus = (typeof TRANSFORMATION_STATUSES)[number];

export interface TransformationRecordData {
  id?: string;
  timestamp?: Date;
  file: string;
  operation: string;
  rewriteRule: string;
  before: string;
  after: string;
  generatedFiles: string[];
  modifiedImports: string[];
  status: TransformationStatus;
  reason?: string;
  benefit?: string;
  riskLevel?: RiskLevel;
  generatedBy?: string;
  generatedAt?: string;
  templateUsed?: string;
  compilerVersion?: string;
}

export class TransformationRecord {
  readonly id: string;
  readonly timestamp: Date;
  readonly file: string;
  readonly operation: string;
  readonly rewriteRule: string;
  readonly before: string;
  readonly after: string;
  readonly generatedFiles: string[];
  readonly modifiedImports: string[];
  readonly status: TransformationStatus;
  readonly reason: string;
  readonly benefit: string;
  readonly riskLevel: RiskLevel;
  readonly generatedBy: string;
  readonly generatedAt: string;
  readonly templateUsed: string;
  readonly compilerVersion: string;

  constructor(data: TransformationRecordData) {
    this.id = data.id ?? randomUUID();
    this.timestamp = data.timestamp ?? new Date();
    this.file = data.file;
    this.operation = data.operation;
    this.rewriteRule = data.rewriteRule;
    this.before = data.before;
    this.after = data.after;
    this.generatedFiles = data.generatedFiles;
    this.modifiedImports = data.modifiedImports;
    this.status = data.status;
    this.reason = data.reason ?? '';
    this.benefit = data.benefit ?? '';
    this.riskLevel = data.riskLevel ?? 'LOW';
    this.generatedBy = data.generatedBy ?? '';
    this.generatedAt = data.generatedAt ?? this.timestamp.toISOString();
    this.templateUsed = data.templateUsed ?? '';
    this.compilerVersion = data.compilerVersion ?? VERSION;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      timestamp: this.timestamp.toISOString(),
      file: this.file,
      operation: this.operation,
      rewriteRule: this.rewriteRule,
      before: this.before,
      after: this.after,
      generatedFiles: this.generatedFiles,
      modifiedImports: this.modifiedImports,
      status: this.status,
      reason: this.reason,
      benefit: this.benefit,
      riskLevel: this.riskLevel,
      generatedBy: this.generatedBy,
      generatedAt: this.generatedAt,
      templateUsed: this.templateUsed,
      compilerVersion: this.compilerVersion,
    };
  }

  static fromJSON(data: Record<string, unknown>): TransformationRecord {
    return new TransformationRecord({
      id: String(data.id),
      timestamp: new Date(String(data.timestamp)),
      file: String(data.file),
      operation: String(data.operation),
      rewriteRule: String(data.rewriteRule),
      before: String(data.before ?? ''),
      after: String(data.after ?? ''),
      generatedFiles: Array.isArray(data.generatedFiles)
        ? data.generatedFiles.map(String)
        : [],
      modifiedImports: Array.isArray(data.modifiedImports)
        ? data.modifiedImports.map(String)
        : [],
      status: (data.status as TransformationStatus) ?? 'COMPLETED',
      reason: data.reason ? String(data.reason) : undefined,
      benefit: data.benefit ? String(data.benefit) : undefined,
      riskLevel: data.riskLevel ? (String(data.riskLevel) as RiskLevel) : undefined,
      generatedBy: data.generatedBy ? String(data.generatedBy) : undefined,
      generatedAt: data.generatedAt ? String(data.generatedAt) : undefined,
      templateUsed: data.templateUsed ? String(data.templateUsed) : undefined,
      compilerVersion: data.compilerVersion ? String(data.compilerVersion) : undefined,
    });
  }
}
