export interface RuntimeGeneratedFile {
  fileName: string;
  relativePath: string;
  absolutePath: string;
}

export interface RuntimeResultData {
  generatedFiles: RuntimeGeneratedFile[];
  startedAt: Date;
  finishedAt: Date;
}

export class RuntimeResult {
  readonly generatedFiles: RuntimeGeneratedFile[];
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: RuntimeResultData) {
    this.generatedFiles = data.generatedFiles;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
}
