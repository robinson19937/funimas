export interface WorkspaceResultData {
  originalProject: string;
  workspaceProject: string;
  filesCopied: number;
  startedAt: Date;
  finishedAt: Date;
}

export class WorkspaceResult {
  readonly originalProject: string;
  readonly workspaceProject: string;
  readonly filesCopied: number;
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: WorkspaceResultData) {
    this.originalProject = data.originalProject;
    this.workspaceProject = data.workspaceProject;
    this.filesCopied = data.filesCopied;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
}
