import { join } from 'node:path';

import { AdapterCapabilities } from '../AdapterCapabilities.js';
import type { AdapterContext } from '../AdapterContext.js';
import { pathExists } from '../adapter-path.js';
import type { AdapterDetectionResult } from '../AdapterResult.js';
import { BasePlatformAdapter } from '../PlatformAdapter.js';

const VERCEL_MARKER = 'vercel.json';

/**
 * Adaptador para proyectos desplegados en Vercel.
 */
export class VercelAdapter extends BasePlatformAdapter {
  readonly id = 'vercel';
  readonly name = 'Vercel';
  readonly capabilities = new AdapterCapabilities({
    platform: 'vercel',
    features: ['runtime', 'functions', 'edge-functions', 'environment', 'configuration'],
  });

  async detect(context: AdapterContext): Promise<AdapterDetectionResult> {
    const markerPath = join(context.getTargetPath(), VERCEL_MARKER);
    const detected = await pathExists(markerPath);

    return {
      detected,
      marker: detected ? VERCEL_MARKER : undefined,
    };
  }
}
