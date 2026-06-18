export interface ImportInfoData {
  moduleSpecifier: string;
  namedImports: string[];
  defaultImport?: string;
  namespaceImport?: string;
}

export class ImportInfo {
  readonly moduleSpecifier: string;
  readonly namedImports: string[];
  readonly defaultImport?: string;
  readonly namespaceImport?: string;

  constructor(data: ImportInfoData) {
    this.moduleSpecifier = data.moduleSpecifier;
    this.namedImports = data.namedImports;
    this.defaultImport = data.defaultImport;
    this.namespaceImport = data.namespaceImport;
  }
}
