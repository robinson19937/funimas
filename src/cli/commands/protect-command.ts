import type { PlannerResult } from '../../planner/PlannerResult.js';
import { ProtectPipeline, type ProtectPipelineOptions } from '../../pipeline/ProtectPipeline.js';
import type { ProtectPipelineResult } from '../../pipeline/ProtectPipelineResult.js';

export type ProtectCommandOptions = ProtectPipelineOptions;

/**
 * Punto de entrada del comando protect.
 * Delega toda la lógica del compilador en ProtectPipeline.
 */
export class ProtectCommand {
  private readonly pipeline: ProtectPipeline;

  constructor(options: ProtectCommandOptions) {
    this.pipeline = new ProtectPipeline(options);
  }

  async execute(): Promise<PlannerResult> {
    const result = await this.pipeline.execute();

    return result.plannerResult;
  }

  async executePipeline(): Promise<ProtectPipelineResult> {
    return this.pipeline.execute();
  }
}
