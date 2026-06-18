import type { AstSourceFile } from './AstSourceFile.js';

export interface AstProjectData {
  projectPath: string;
  totalFiles: number;
  totalTypescriptFiles: number;
  totalJavascriptFiles: number;
  sourceFiles: AstSourceFile[];
}

export class AstProject {
  readonly projectPath: string;
  readonly totalFiles: number;
  readonly totalTypescriptFiles: number;
  readonly totalJavascriptFiles: number;
  readonly sourceFiles: AstSourceFile[];

  constructor(data: AstProjectData) {
    this.projectPath = data.projectPath;
    this.totalFiles = data.totalFiles;
    this.totalTypescriptFiles = data.totalTypescriptFiles;
    this.totalJavascriptFiles = data.totalJavascriptFiles;
    this.sourceFiles = data.sourceFiles;
  }
}
