import type { AdapterCapabilities } from './AdapterCapabilities.js';
import type { AdapterFeature } from './AdapterCapabilities.js';
import type { AdapterContext } from './AdapterContext.js';
import type {
  AdapterConfigurationArtifact,
  AdapterDetectionResult,
  AdapterEnvironmentArtifact,
  AdapterFunctionArtifact,
  AdapterResult,
  AdapterRuntimeArtifact,
  AdapterValidationArtifact,
} from './AdapterResult.js';
import {
  createEmptyAdapterResult,
  createEmptyConfigurationArtifact,
  createEmptyEnvironmentArtifact,
  createEmptyFunctionArtifact,
  createEmptyRuntimeArtifact,
  createEmptyValidationArtifact,
} from './AdapterResult.js';

/**
 * Contrato que todo adaptador de plataforma debe implementar.
 * El compilador solo interactúa con esta interfaz, nunca con proveedores concretos.
 */
export interface PlatformAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AdapterCapabilities;

  detect(context: AdapterContext): Promise<AdapterDetectionResult>;
  generateRuntime(context: AdapterContext): Promise<AdapterResult<AdapterRuntimeArtifact>>;
  generateFunction(context: AdapterContext): Promise<AdapterResult<AdapterFunctionArtifact>>;
  generateConfiguration(
    context: AdapterContext,
  ): Promise<AdapterResult<AdapterConfigurationArtifact>>;
  generateEnvironment(
    context: AdapterContext,
  ): Promise<AdapterResult<AdapterEnvironmentArtifact>>;
  validate(context: AdapterContext): Promise<AdapterResult<AdapterValidationArtifact>>;
  supports(feature: AdapterFeature): boolean;
}

/**
 * Implementación base con respuestas vacías para métodos aún no personalizados.
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly capabilities: AdapterCapabilities;

  abstract detect(context: AdapterContext): Promise<AdapterDetectionResult>;

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

  async generateConfiguration(
    _context: AdapterContext,
  ): Promise<AdapterResult<AdapterConfigurationArtifact>> {
    return createEmptyAdapterResult(createEmptyConfigurationArtifact());
  }

  async generateEnvironment(
    _context: AdapterContext,
  ): Promise<AdapterResult<AdapterEnvironmentArtifact>> {
    return createEmptyAdapterResult(createEmptyEnvironmentArtifact());
  }

  async validate(_context: AdapterContext): Promise<AdapterResult<AdapterValidationArtifact>> {
    return createEmptyAdapterResult(createEmptyValidationArtifact());
  }

  supports(feature: AdapterFeature): boolean {
    return this.capabilities.supports(feature);
  }
}
