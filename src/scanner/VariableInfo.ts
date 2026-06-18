export interface VariableInfoData {
  name: string;
  type?: string;
  isExported: boolean;
}

export class VariableInfo {
  readonly name: string;
  readonly type?: string;
  readonly isExported: boolean;

  constructor(data: VariableInfoData) {
    this.name = data.name;
    this.type = data.type;
    this.isExported = data.isExported;
  }
}
