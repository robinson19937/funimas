export type DomainWriteKind = 'insert' | 'set' | 'upsert' | 'update' | 'delete';

export type DomainPathSegment = string | { param: string };

export interface DomainWrite {
  kind: DomainWriteKind;
  path: DomainPathSegment[];
  dataTemplate?: Record<string, unknown>;
}

export interface DomainMutation {
  id: string;
  file: string;
  functionName: string;
  startLine: number;
  invokeParams: string[];
  params: string[];
  writes: DomainWrite[];
  operationKeys: string[];
}

export function operationKey(file: string, line: number): string {
  return `${file}:${line}`;
}

export function isGeneratedWorkspaceFile(relativeFile: string): boolean {
  return (
    relativeFile.startsWith('runtime/') ||
    relativeFile.startsWith('shared/') ||
    relativeFile.startsWith('sdk/') ||
    relativeFile.startsWith('netlify/functions/')
  );
}
