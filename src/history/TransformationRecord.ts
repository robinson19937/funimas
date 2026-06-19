import { randomUUID } from 'node:crypto';

import type { RiskLevel } from '../report/RiskLevel.js';
import { VERSION } from '../utils/version.js';

export const TRANSFORMATION_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;

export type TransformationStatus = (typeof TRANSFORMATION_STATUSES)[number];

export const VALIDATION_STATUSES = ['PENDING', 'PASSED', 'FAILED', 'SKIPPED'] as const;

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

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
  validationStatus?: ValidationStatus;
  rollbackExecuted?: boolean;
  rollbackReason?: string;
  validationErrors?: string[];
  executionTime?: number;
  sourceLine?: number;
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
  readonly validationStatus: ValidationStatus;
  readonly rollbackExecuted: boolean;
  readonly rollbackReason: string;
  readonly validationErrors: string[];
  readonly executionTime: number;
  readonly sourceLine?: number;

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
    this.validationStatus = data.validationStatus ?? 'PENDING';
    this.rollbackExecuted = data.rollbackExecuted ?? false;
    this.rollbackReason = data.rollbackReason ?? '';
    this.validationErrors = data.validationErrors ?? [];
    this.executionTime = data.executionTime ?? 0;
    this.sourceLine = data.sourceLine;
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
      validationStatus: this.validationStatus,
      rollbackExecuted: this.rollbackExecuted,
      rollbackReason: this.rollbackReason,
      validationErrors: this.validationErrors,
      executionTime: this.executionTime,
      sourceLine: this.sourceLine,
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
      validationStatus: data.validationStatus
        ? (String(data.validationStatus) as ValidationStatus)
        : undefined,
      rollbackExecuted: data.rollbackExecuted ? Boolean(data.rollbackExecuted) : undefined,
      rollbackReason: data.rollbackReason ? String(data.rollbackReason) : undefined,
      validationErrors: Array.isArray(data.validationErrors)
        ? data.validationErrors.map(String)
        : undefined,
      executionTime: typeof data.executionTime === 'number' ? data.executionTime : undefined,
      sourceLine: typeof data.sourceLine === 'number' ? data.sourceLine : undefined,
    });
  }

  withUpdates(updates: Partial<TransformationRecordData>): TransformationRecord {
    return new TransformationRecord({
      id: this.id,
      timestamp: this.timestamp,
      file: updates.file ?? this.file,
      operation: updates.operation ?? this.operation,
      rewriteRule: updates.rewriteRule ?? this.rewriteRule,
      before: updates.before ?? this.before,
      after: updates.after ?? this.after,
      generatedFiles: updates.generatedFiles ?? this.generatedFiles,
      modifiedImports: updates.modifiedImports ?? this.modifiedImports,
      status: updates.status ?? this.status,
      reason: updates.reason ?? this.reason,
      benefit: updates.benefit ?? this.benefit,
      riskLevel: updates.riskLevel ?? this.riskLevel,
      generatedBy: updates.generatedBy ?? this.generatedBy,
      generatedAt: updates.generatedAt ?? this.generatedAt,
      templateUsed: updates.templateUsed ?? this.templateUsed,
      compilerVersion: updates.compilerVersion ?? this.compilerVersion,
      validationStatus: updates.validationStatus ?? this.validationStatus,
      rollbackExecuted: updates.rollbackExecuted ?? this.rollbackExecuted,
      rollbackReason: updates.rollbackReason ?? this.rollbackReason,
      validationErrors: updates.validationErrors ?? this.validationErrors,
      executionTime: updates.executionTime ?? this.executionTime,
      sourceLine: updates.sourceLine ?? this.sourceLine,
    });
  }
}
