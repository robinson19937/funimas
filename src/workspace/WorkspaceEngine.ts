import { resolve } from 'node:path';

import { WorkspaceResult } from './WorkspaceResult.js';
import {
  assertProjectDirectoryExists,
  assertWorkspaceDoesNotExist,
  getWorkspaceProjectPath,
} from './WorkspaceUtils.js';
import { copyProjectContents } from '../utils/project-fs.js';

export interface WorkspaceService {
  create(projectPath: string): Promise<WorkspaceResult>;
}

export interface WorkspaceEngineOptions {
  now?: () => Date;
}

export class WorkspaceEngine implements WorkspaceService {
  private readonly now: () => Date;

  constructor(options: WorkspaceEngineOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async create(projectPath: string): Promise<WorkspaceResult> {
    const startedAt = this.now();
    const originalProject = resolve(projectPath);

    await assertProjectDirectoryExists(originalProject);

    const workspaceProject = getWorkspaceProjectPath(originalProject);
    await assertWorkspaceDoesNotExist(workspaceProject);

    const filesCopied = await copyProjectContents(originalProject, workspaceProject);
    const finishedAt = this.now();

    return new WorkspaceResult({
      originalProject,
      workspaceProject,
      filesCopied,
      startedAt,
      finishedAt,
    });
  }
}
