import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AdapterCapabilities } from '../AdapterCapabilities.js';
import type { AdapterContext } from '../AdapterContext.js';
import type { GeneratedFile } from '../GeneratedFile.js';
import { detectPlatformMarker } from '../adapter-path.js';
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
import { patchNetlifyToml } from '../../utils/netlify-config-patcher.js';
import { BasePlatformAdapter } from '../PlatformAdapter.js';

const NETLIFY_MARKER = 'netlify.toml';
const NETLIFY_FUNCTIONS_DIR = 'netlify/functions';
const DATABASE_INSERT_TEMPLATE = 'netlify/databaseInsert.hbs';
const ENV_EXAMPLE_TEMPLATE = 'deploy/env.example.hbs';

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
    const detection = await detectPlatformMarker(context, NETLIFY_MARKER);

    return {
      detected: detection.detected,
      marker: detection.detected ? NETLIFY_MARKER : undefined,
      foundAt: detection.foundAt,
      searchedPaths: detection.searchedPaths,
      reason: detection.reason,
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

  async generateConfiguration(context: AdapterContext) {
    const targetPath = context.getTargetPath();
    const netlifyTomlPath = join(targetPath, NETLIFY_MARKER);
    let existing = '';

    try {
      existing = await readFile(netlifyTomlPath, 'utf8');
    } catch {
      existing = '';
    }

    const patchResult = patchNetlifyToml(existing);

    if (patchResult.patched || existing.length === 0) {
      await writeFile(netlifyTomlPath, patchResult.content, 'utf8');
    }

    return createEmptyAdapterResult({
      files: [NETLIFY_MARKER],
      metadata: {
        patched: patchResult.patched || existing.length === 0,
        changes: patchResult.changes,
      },
    });
  }

  async generateEnvironment(context: AdapterContext) {
    const targetPath = context.getTargetPath();
    const envExamplePath = join(targetPath, '.env.example');
    const content = await this.templateEngine.render(ENV_EXAMPLE_TEMPLATE, {});

    await writeFile(envExamplePath, `${content.trimEnd()}\n`, 'utf8');

    return createEmptyAdapterResult({
      variables: [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FUNIMAS_API_URL',
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
      ],
      metadata: {
        file: '.env.example',
      },
    });
  }
}
