import type { FileInfo } from './FileInfo.js';

export interface ScanResultData {
  projectPath: string;
  files: FileInfo[];
  totalFiles: number;
  totalImports: number;
  totalFunctions: number;
  totalClasses: number;
  totalInterfaces: number;
  totalEnums: number;
  totalVariables: number;
  startedAt: Date;
  finishedAt: Date;
}

export class ScanResult {
  readonly projectPath: string;
  readonly files: FileInfo[];
  readonly totalFiles: number;
  readonly totalImports: number;
  readonly totalFunctions: number;
  readonly totalClasses: number;
  readonly totalInterfaces: number;
  readonly totalEnums: number;
  readonly totalVariables: number;
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: ScanResultData) {
    this.projectPath = data.projectPath;
    this.files = data.files;
    this.totalFiles = data.totalFiles;
    this.totalImports = data.totalImports;
    this.totalFunctions = data.totalFunctions;
    this.totalClasses = data.totalClasses;
    this.totalInterfaces = data.totalInterfaces;
    this.totalEnums = data.totalEnums;
    this.totalVariables = data.totalVariables;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
}
