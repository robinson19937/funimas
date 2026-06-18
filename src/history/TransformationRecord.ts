import { randomUUID } from 'node:crypto';

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
    });
  }
}
