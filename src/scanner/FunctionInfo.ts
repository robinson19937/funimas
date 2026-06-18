import type { SourceLocation } from './SourceLocation.js';

export interface FunctionInfoData {
  name: string;
  parameters: string[];
  isAsync: boolean;
  isExported: boolean;
  location: SourceLocation;
}

export class FunctionInfo {
  readonly name: string;
  readonly parameters: string[];
  readonly isAsync: boolean;
  readonly isExported: boolean;
  readonly location: SourceLocation;

  constructor(data: FunctionInfoData) {
    this.name = data.name;
    this.parameters = data.parameters;
    this.isAsync = data.isAsync;
    this.isExported = data.isExported;
    this.location = data.location;
  }
}
