import type { PropertyInfo } from './PropertyInfo.js';

export interface InterfaceInfoData {
  name: string;
  properties: PropertyInfo[];
}

export class InterfaceInfo {
  readonly name: string;
  readonly properties: PropertyInfo[];

  constructor(data: InterfaceInfoData) {
    this.name = data.name;
    this.properties = data.properties;
  }
}
