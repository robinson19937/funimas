import { join } from 'node:path';

import { AdapterCapabilities } from '../AdapterCapabilities.js';
import type { AdapterContext } from '../AdapterContext.js';
import type { GeneratedFile } from '../GeneratedFile.js';
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
import { operationTypeToFileName } from '../../utils/operation-naming.js';
import { RuntimeTemplateEngine } from '../../runtime/RuntimeTemplateEngine.js';
import { BasePlatformAdapter } from '../PlatformAdapter.js';

const NETLIFY_MARKER = 'netlify.toml';
const NETLIFY_FUNCTIONS_DIR = 'netlify/functions';
const DATABASE_INSERT_TEMPLATE = 'netlify/databaseInsert.hbs';

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
  private readonly templateEngine: RuntimeTemplateEngine;

  constructor(templateEngine: RuntimeTemplateEngine = new RuntimeTemplateEngine()) {
    super();
    this.templateEngine = templateEngine;
  }

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

  async generateFunction(context: AdapterContext): Promise<AdapterResult<AdapterFunctionArtifact>> {
    const operation = context.operation;

    if (!operation || operation.type !== 'DATABASE_INSERT') {
      return createEmptyAdapterResult(createEmptyFunctionArtifact());
    }

    const fileName = `${operationTypeToFileName(operation.type)}.ts`;
    const content = await this.templateEngine.render(DATABASE_INSERT_TEMPLATE);
    const file: GeneratedFile = {
      fileName,
      relativePath: join(NETLIFY_FUNCTIONS_DIR, fileName),
      content,
    };

    return createEmptyAdapterResult({
      files: [file],
      functions: [fileName],
      metadata: {
        operationType: operation.type,
        platform: this.id,
        templateUsed: `templates/${DATABASE_INSERT_TEMPLATE}`,
      },
    });
  }
}
