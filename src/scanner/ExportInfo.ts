export interface ExportInfoData {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'enum' | 'variable' | 'unknown';
}

export class ExportInfo {
  readonly name: string;
  readonly kind: ExportInfoData['kind'];

  constructor(data: ExportInfoData) {
    this.name = data.name;
    this.kind = data.kind;
  }
}
