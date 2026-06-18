export interface BackupResultData {
  backupPath: string;
  relativeBackupPath: string;
  filesCopied: number;
  startedAt: Date;
  finishedAt: Date;
}

export class BackupResult {
  readonly backupPath: string;
  readonly relativeBackupPath: string;
  readonly filesCopied: number;
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: BackupResultData) {
    this.backupPath = data.backupPath;
    this.relativeBackupPath = data.relativeBackupPath;
    this.filesCopied = data.filesCopied;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
}
