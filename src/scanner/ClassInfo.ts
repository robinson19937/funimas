import type { FunctionInfo } from './FunctionInfo.js';
import type { PropertyInfo } from './PropertyInfo.js';

export interface ClassInfoData {
  name: string;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  extendsClass?: string;
  implementsInterfaces: string[];
}

export class ClassInfo {
  readonly name: string;
  readonly methods: FunctionInfo[];
  readonly properties: PropertyInfo[];
  readonly extendsClass?: string;
  readonly implementsInterfaces: string[];

  constructor(data: ClassInfoData) {
    this.name = data.name;
    this.methods = data.methods;
    this.properties = data.properties;
    this.extendsClass = data.extendsClass;
    this.implementsInterfaces = data.implementsInterfaces;
  }
}
