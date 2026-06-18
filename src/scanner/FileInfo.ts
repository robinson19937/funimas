import type { ClassInfo } from './ClassInfo.js';
import type { EnumInfo } from './EnumInfo.js';
import type { ExportInfo } from './ExportInfo.js';
import type { FunctionInfo } from './FunctionInfo.js';
import type { ImportInfo } from './ImportInfo.js';
import type { InterfaceInfo } from './InterfaceInfo.js';
import type { VariableInfo } from './VariableInfo.js';

export interface FileInfoData {
  path: string;
  name: string;
  extension: string;
  size: number;
  lineCount: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  enums: EnumInfo[];
  variables: VariableInfo[];
}

export class FileInfo {
  readonly path: string;
  readonly name: string;
  readonly extension: string;
  readonly size: number;
  readonly lineCount: number;
  readonly imports: ImportInfo[];
  readonly exports: ExportInfo[];
  readonly functions: FunctionInfo[];
  readonly classes: ClassInfo[];
  readonly interfaces: InterfaceInfo[];
  readonly enums: EnumInfo[];
  readonly variables: VariableInfo[];

  constructor(data: FileInfoData) {
    this.path = data.path;
    this.name = data.name;
    this.extension = data.extension;
    this.size = data.size;
    this.lineCount = data.lineCount;
    this.imports = data.imports;
    this.exports = data.exports;
    this.functions = data.functions;
    this.classes = data.classes;
    this.interfaces = data.interfaces;
    this.enums = data.enums;
    this.variables = data.variables;
  }
}
