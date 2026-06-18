import { join } from 'node:path';

import { AdapterCapabilities } from '../AdapterCapabilities.js';
import type { AdapterContext } from '../AdapterContext.js';
import { pathExists } from '../adapter-path.js';
import type {
  AdapterDetectionResult,
  AdapterFunctionArtifact,
  AdapterResult,
  AdapterRuntimeArtifact,
} from '../AdapterResult.js';
import {
  createEmptyAdapterResult,
  createEmptyFunctionArtifact,
  createEmptyRuntimeArtifact,
} from '../AdapterResult.js';
import { BasePlatformAdapter } from '../PlatformAdapter.js';

const NETLIFY_MARKER = 'netlify.toml';

/**
 * Adaptador para proyectos desplegados en Netlify.
 */
export class NetlifyAdapter extends BasePlatformAdapter {
  readonly id = 'netlify';
  readonly name = 'Netlify';
  readonly capabilities = new AdapterCapabilities({
    platform: 'netlify',
    features: [
      'runtime',
      'functions',
      'edge-functions',
      'scheduled-functions',
      'environment',
      'configuration',
    ],
  });

  async detect(context: AdapterContext): Promise<AdapterDetectionResult> {
    const markerPath = join(context.getTargetPath(), NETLIFY_MARKER);
    const detected = await pathExists(markerPath);

    return {
      detected,
      marker: detected ? NETLIFY_MARKER : undefined,
    };
  }

  async generateRuntime(
    _context: AdapterContext,
  ): Promise<AdapterResult<AdapterRuntimeArtifact>> {
    return createEmptyAdapterResult(createEmptyRuntimeArtifact());
  }

  async generateFunction(
    _context: AdapterContext,
  ): Promise<AdapterResult<AdapterFunctionArtifact>> {
    return createEmptyAdapterResult(createEmptyFunctionArtifact());
  }
}
