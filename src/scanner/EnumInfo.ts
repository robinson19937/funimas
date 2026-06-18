export interface EnumInfoData {
  name: string;
  values: string[];
}

export class EnumInfo {
  readonly name: string;
  readonly values: string[];

  constructor(data: EnumInfoData) {
    this.name = data.name;
    this.values = data.values;
  }
}
