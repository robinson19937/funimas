import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { TransformationHistory } from '../history/TransformationHistory.js';
import { VERSION } from '../utils/version.js';

import type { DomainMutation, DomainPathSegment } from './DomainMutation.js';

function serializePathSegment(segment: DomainPathSegment): string {
  if (typeof segment === 'string') {
    return JSON.stringify(segment);
  }

  return `{ param: ${JSON.stringify(segment.param)} }`;
}

function renderMutationRegistry(mutations: DomainMutation[]): string {
  const entries = mutations
    .map((mutation) => {
      const writes = mutation.writes
        .map((write) => {
          const pathLiteral = `[${write.path.map(serializePathSegment).join(', ')}]`;
          const dataLiteral = write.dataTemplate
            ? `, dataTemplate: ${JSON.stringify(write.dataTemplate, null, 2)}`
            : '';

          return `      { kind: '${write.kind}', path: ${pathLiteral}${dataLiteral} }`;
        })
        .join(',\n');

      return `  ${JSON.stringify(mutation.id)}: {
    params: ${JSON.stringify(mutation.params)},
    writes: [
${writes}
    ],
  }`;
    })
    .join(',\n');

  return `export type DomainWriteKind = 'insert' | 'set' | 'upsert' | 'update' | 'delete';

export type DomainPathSegment = string | { param: string };

export interface DomainWriteDefinition {
  kind: DomainWriteKind;
  path: DomainPathSegment[];
  dataTemplate?: Record<string, unknown>;
}

export interface DomainMutationDefinition {
  params: string[];
  writes: DomainWriteDefinition[];
}

export const DOMAIN_MUTATIONS: Record<string, DomainMutationDefinition> = {
${entries}
};

export function getDomainMutation(mutationId: string): DomainMutationDefinition | undefined {
  return DOMAIN_MUTATIONS[mutationId];
}

export function resolveTemplateValue(value: unknown, params: Record<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    const key = value.slice(1);

    if (!key.includes('.')) {
      return params[key];
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveTemplateValue(entry, params));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveTemplateValue(entry, params)]),
    );
  }

  return value;
}

export function resolvePathSegments(
  segments: DomainPathSegment[],
  params: Record<string, unknown>,
): string[] {
  return segments.map((segment) => {
    if (typeof segment === 'string') {
      return segment;
    }

    const value = params[segment.param];

    if (value === undefined || value === null) {
      throw new Error(\`Falta el parámetro de dominio "\${segment.param}".\`);
    }

    return String(value);
  });
}
`;
}

export class DomainMutationRegistryGenerator {
  async generate(
    workspacePath: string,
    mutations: DomainMutation[],
    history?: TransformationHistory,
  ): Promise<string> {
    const relativePath = 'runtime/domain/mutations.ts';
    const absolutePath = join(workspacePath, relativePath);
    const content = `${renderMutationRegistry(mutations)}\n`;

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');

    if (history && mutations.length > 0) {
      await history.record({
        file: absolutePath,
        operation: 'GENERATE_RUNTIME',
        rewriteRule: 'DomainMutationRegistryGenerator',
        before: '',
        after: content,
        generatedFiles: [relativePath],
        modifiedImports: [],
        status: 'COMPLETED',
        reason: 'Las mutaciones de dominio agrupan escrituras multi-documento en transacciones atómicas.',
        benefit: 'Operaciones compuestas ejecutadas en el servidor con cualquier estructura de colecciones.',
        riskLevel: 'MEDIUM',
        generatedBy: 'DomainMutationRegistryGenerator',
        templateUsed: 'runtime/domain/mutations.ts',
        compilerVersion: VERSION,
      });
    }

    return relativePath;
  }
}
