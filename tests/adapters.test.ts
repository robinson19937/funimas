import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ADAPTER_FEATURE_LABELS,
  AdapterCapabilities,
  AdapterContext,
  AdapterRegistry,
  AwsLambdaAdapter,
  NetlifyAdapter,
  VercelAdapter,
  createDefaultAdapterRegistry,
  createEmptyRuntimeArtifact,
} from '../src/adapters/index.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('AdapterRegistry', () => {
  it('registra adaptadores y permite recuperarlos por id', () => {
    const registry = new AdapterRegistry();
    const netlify = new NetlifyAdapter();
    const vercel = new VercelAdapter();

    registry.register(netlify);
    registry.register(vercel);

    expect(registry.getAdapters()).toHaveLength(2);
    expect(registry.getAdapter('netlify')).toBe(netlify);
    expect(registry.getAdapter('missing')).toBeUndefined();
  });

  it('registra múltiples adaptadores con registerMany', () => {
    const registry = new AdapterRegistry();

    registry.registerMany([new NetlifyAdapter(), new VercelAdapter(), new AwsLambdaAdapter()]);

    expect(registry.getAdapters()).toHaveLength(3);
  });

  it('crea un registro por defecto con los adaptadores integrados', () => {
    const registry = createDefaultAdapterRegistry();

    expect(registry.getAdapters()).toHaveLength(3);
    expect(registry.getAdapter('netlify')).toBeDefined();
    expect(registry.getAdapter('vercel')).toBeDefined();
    expect(registry.getAdapter('aws-lambda')).toBeDefined();
  });

  it('detecta automáticamente Netlify cuando existe netlify.toml', async () => {
    const registry = createDefaultAdapterRegistry();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'netlify-project'),
    });

    const detection = await registry.detect(context);

    expect(detection.detected).toBe(true);
    expect(detection.adapter?.id).toBe('netlify');
    expect(detection.adapter?.name).toBe('Netlify');
  });

  it('detecta automáticamente Vercel cuando existe vercel.json', async () => {
    const registry = createDefaultAdapterRegistry();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'vercel-project'),
    });

    const detection = await registry.detect(context);

    expect(detection.detected).toBe(true);
    expect(detection.adapter?.id).toBe('vercel');
  });

  it('detecta automáticamente AWS cuando existe serverless.yml', async () => {
    const registry = createDefaultAdapterRegistry();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'aws-project'),
    });

    const detection = await registry.detect(context);

    expect(detection.detected).toBe(true);
    expect(detection.adapter?.id).toBe('aws-lambda');
  });

  it('devuelve no detectado cuando no hay marcadores de plataforma', async () => {
    const registry = createDefaultAdapterRegistry();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'plain-project'),
    });

    const detection = await registry.detect(context);

    expect(detection.detected).toBe(false);
    expect(detection.adapter).toBeUndefined();
  });

  it('prioriza el primer adaptador que detecta la plataforma', async () => {
    const registry = new AdapterRegistry();
    const netlify = new NetlifyAdapter();
    const vercel = new VercelAdapter();

    registry.registerMany([netlify, vercel]);

    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'netlify-project'),
    });

    const detection = await registry.detect(context);

    expect(detection.adapter).toBe(netlify);
  });
});

describe('AdapterCapabilities', () => {
  it('indica qué capacidades soporta cada adaptador', () => {
    const netlify = new NetlifyAdapter();
    const aws = new AwsLambdaAdapter();

    expect(netlify.supports('runtime')).toBe(true);
    expect(netlify.supports('functions')).toBe(true);
    expect(netlify.supports('edge-functions')).toBe(true);
    expect(netlify.supports('scheduled-functions')).toBe(true);
    expect(netlify.supports('lambda')).toBe(false);

    expect(aws.supports('lambda')).toBe(true);
    expect(aws.supports('api-gateway')).toBe(true);
    expect(aws.supports('runtime')).toBe(false);
  });

  it('expone etiquetas legibles para las capacidades', () => {
    const capabilities = new AdapterCapabilities({
      platform: 'netlify',
      features: ['runtime', 'functions', 'environment'],
    });

    expect(capabilities.getDisplayFeatures()).toEqual([
      ADAPTER_FEATURE_LABELS.runtime,
      ADAPTER_FEATURE_LABELS.functions,
      ADAPTER_FEATURE_LABELS.environment,
    ]);
  });
});

describe('NetlifyAdapter', () => {
  it('detecta proyectos Netlify por netlify.toml', async () => {
    const adapter = new NetlifyAdapter();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'netlify-project'),
    });

    const detection = await adapter.detect(context);

    expect(detection.detected).toBe(true);
    expect(detection.marker).toBe('netlify.toml');
  });

  it('devuelve estructuras vacías al generar runtime y functions', async () => {
    const adapter = new NetlifyAdapter();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'netlify-project'),
    });

    const runtime = await adapter.generateRuntime(context);
    const functions = await adapter.generateFunction(context);

    expect(runtime.success).toBe(true);
    expect(runtime.data).toEqual(createEmptyRuntimeArtifact());
    expect(functions.success).toBe(true);
    expect(functions.data.functions).toEqual([]);
  });

  it('usa workspacePath como ruta de detección cuando está disponible', async () => {
    const adapter = new NetlifyAdapter();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'plain-project'),
      workspacePath: join(fixturesDir, 'netlify-project'),
    });

    const detection = await adapter.detect(context);

    expect(detection.detected).toBe(true);
  });
});

describe('VercelAdapter', () => {
  it('detecta proyectos Vercel por vercel.json', async () => {
    const adapter = new VercelAdapter();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'vercel-project'),
    });

    const detection = await adapter.detect(context);

    expect(detection.detected).toBe(true);
    expect(detection.marker).toBe('vercel.json');
  });
});

describe('AwsLambdaAdapter', () => {
  it('detecta proyectos AWS por serverless.yml', async () => {
    const adapter = new AwsLambdaAdapter();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'aws-project'),
    });

    const detection = await adapter.detect(context);

    expect(detection.detected).toBe(true);
    expect(detection.marker).toBe('serverless.yml');
  });
});

describe('AdapterContext', () => {
  it('resuelve la ruta objetivo priorizando el workspace', () => {
    const context = new AdapterContext({
      projectPath: '/tmp/original',
      workspacePath: '/tmp/original_funimas',
    });

    expect(context.getTargetPath()).toBe('/tmp/original_funimas');
  });
});

describe('BasePlatformAdapter', () => {
  it('expone métodos base con estructuras vacías', async () => {
    const adapter = new VercelAdapter();
    const context = new AdapterContext({
      projectPath: join(fixturesDir, 'vercel-project'),
    });

    const configuration = await adapter.generateConfiguration(context);
    const environment = await adapter.generateEnvironment(context);
    const validation = await adapter.validate(context);

    expect(configuration.success).toBe(true);
    expect(configuration.data.files).toEqual([]);
    expect(environment.success).toBe(true);
    expect(environment.data.variables).toEqual([]);
    expect(validation.success).toBe(true);
    expect(validation.data.valid).toBe(true);
  });
});
