import { AdapterCapabilities } from '../AdapterCapabilities.js';
import type { AdapterContext } from '../AdapterContext.js';
import { detectPlatformMarker } from '../adapter-path.js';
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
    const detection = await detectPlatformMarker(context, VERCEL_MARKER);

    return {
      detected: detection.detected,
      marker: detection.detected ? VERCEL_MARKER : undefined,
      foundAt: detection.foundAt,
      searchedPaths: detection.searchedPaths,
      reason: detection.reason,
    };
  }
}
