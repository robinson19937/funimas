export interface PropertyInfoData {
  name: string;
  type?: string;
}

export class PropertyInfo {
  readonly name: string;
  readonly type?: string;

  constructor(data: PropertyInfoData) {
    this.name = data.name;
    this.type = data.type;
  }
}
