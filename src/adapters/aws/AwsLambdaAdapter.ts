import { join } from 'node:path';

import { AdapterCapabilities } from '../AdapterCapabilities.js';
import type { AdapterContext } from '../AdapterContext.js';
import { pathExists } from '../adapter-path.js';
import type { AdapterDetectionResult } from '../AdapterResult.js';
import { BasePlatformAdapter } from '../PlatformAdapter.js';

const AWS_MARKERS = ['serverless.yml', 'serverless.yaml', 'template.yaml', 'samconfig.toml'] as const;

/**
 * Adaptador para proyectos desplegados en AWS Lambda.
 */
export class AwsLambdaAdapter extends BasePlatformAdapter {
  readonly id = 'aws-lambda';
  readonly name = 'AWS Lambda';
  readonly capabilities = new AdapterCapabilities({
    platform: 'aws',
    features: ['lambda', 'api-gateway', 'environment', 'configuration'],
  });

  async detect(context: AdapterContext): Promise<AdapterDetectionResult> {
    const targetPath = context.getTargetPath();

    for (const marker of AWS_MARKERS) {
      const markerPath = join(targetPath, marker);

      if (await pathExists(markerPath)) {
        return {
          detected: true,
          marker,
        };
      }
    }

    return { detected: false };
  }
}
