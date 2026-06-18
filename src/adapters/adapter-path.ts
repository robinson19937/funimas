import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { AdapterContext } from './AdapterContext.js';

export interface PlatformMarkerDetection {
  detected: boolean;
  marker?: string;
  foundAt?: string;
  searchedPaths: string[];
  reason?: string;
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function getDetectionSearchPaths(context: AdapterContext): string[] {
  const paths: string[] = [];
  const workspacePath = context.workspacePath ? resolve(context.workspacePath) : undefined;
  const projectPath = resolve(context.projectPath);

  if (workspacePath) {
    paths.push(workspacePath);
  }

  if (!paths.includes(projectPath)) {
    paths.push(projectPath);
  }

  return paths;
}

export async function detectPlatformMarker(
  context: AdapterContext,
  marker: string,
): Promise<PlatformMarkerDetection> {
  const searchedPaths: string[] = [];

  for (const basePath of getDetectionSearchPaths(context)) {
    const markerPath = join(basePath, marker);
    searchedPaths.push(markerPath);

    if (await pathExists(markerPath)) {
      return {
        detected: true,
        marker,
        foundAt: markerPath,
        searchedPaths,
      };
    }
  }

  return {
    detected: false,
    searchedPaths,
    reason: `No se encontró ${marker}`,
  };
}

export async function detectPlatformMarkers(
  context: AdapterContext,
  markers: readonly string[],
): Promise<PlatformMarkerDetection> {
  const searchedPaths: string[] = [];

  for (const basePath of getDetectionSearchPaths(context)) {
    for (const marker of markers) {
      const markerPath = join(basePath, marker);
      searchedPaths.push(markerPath);

      if (await pathExists(markerPath)) {
        return {
          detected: true,
          marker,
          foundAt: markerPath,
          searchedPaths,
        };
      }
    }
  }

  return {
    detected: false,
    searchedPaths,
    reason: `No se encontró ninguno de: ${markers.join(', ')}`,
  };
}
