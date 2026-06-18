import type { AstProject } from './AstProject.js';

export interface AstParserResultData {
  project: AstProject;
  startedAt: Date;
  finishedAt: Date;
}

export class AstParserResult {
  readonly project: AstProject;
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: AstParserResultData) {
    this.project = data.project;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
}
