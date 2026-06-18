export interface AstSourceFileData {
  path: string;
  name: string;
  extension: string;
  importCount: number;
  functionCount: number;
  classCount: number;
}

export class AstSourceFile {
  readonly path: string;
  readonly name: string;
  readonly extension: string;
  readonly importCount: number;
  readonly functionCount: number;
  readonly classCount: number;

  constructor(data: AstSourceFileData) {
    this.path = data.path;
    this.name = data.name;
    this.extension = data.extension;
    this.importCount = data.importCount;
    this.functionCount = data.functionCount;
    this.classCount = data.classCount;
  }
}
