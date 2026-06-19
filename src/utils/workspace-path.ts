import { resolve } from 'node:path';

/**
 * Resuelve la ruta del workspace Funimas a partir de un proyecto o workspace.
 */
export function resolveWorkspacePath(inputPath: string): string {
  const resolved = resolve(inputPath);

  if (resolved.endsWith('_funimas')) {
    return resolved;
  }

  return `${resolved}_funimas`;
}
