import type { ExportInfo } from '../scanner/ExportInfo.js';
import type { ImportInfo } from '../scanner/ImportInfo.js';

export interface DependencyNodeData {
  id: string;
  name: string;
  path: string;
  extension: string;
  size: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
}

export class DependencyNode {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly extension: string;
  readonly size: number;
  readonly imports: ImportInfo[];
  readonly exports: ExportInfo[];

  constructor(data: DependencyNodeData) {
    this.id = data.id;
    this.name = data.name;
    this.path = data.path;
    this.extension = data.extension;
    this.size = data.size;
    this.imports = data.imports;
    this.exports = data.exports;
  }
}
