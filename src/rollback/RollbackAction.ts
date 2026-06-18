export const ROLLBACK_ACTION_TYPES = ['RESTORE_SNIPPET', 'DELETE_GENERATED', 'RESTORE_FILE'] as const;

export type RollbackActionType = (typeof ROLLBACK_ACTION_TYPES)[number];

export interface RollbackActionData {
  type: RollbackActionType;
  file: string;
  transformationId: string;
  description: string;
}

export class RollbackAction {
  readonly type: RollbackActionType;
  readonly file: string;
  readonly transformationId: string;
  readonly description: string;

  constructor(data: RollbackActionData) {
    this.type = data.type;
    this.file = data.file;
    this.transformationId = data.transformationId;
    this.description = data.description;
  }

  toJSON(): RollbackActionData {
    return {
      type: this.type,
      file: this.file,
      transformationId: this.transformationId,
      description: this.description,
    };
  }
}
