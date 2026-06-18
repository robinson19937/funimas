export {
  ADAPTER_FEATURES,
  ADAPTER_FEATURE_LABELS,
  AdapterCapabilities,
  type AdapterCapabilitiesData,
  type AdapterFeature,
} from './AdapterCapabilities.js';
export { AdapterContext, type AdapterContextData } from './AdapterContext.js';
export {
  AdapterRegistry,
  createDefaultAdapterRegistry,
  type AdapterDetectionAttempt,
  type AdapterRegistryDetectionResult,
  type AdapterRegistryService,
} from './AdapterRegistry.js';
export { type GeneratedFile } from './GeneratedFile.js';
export {
  createEmptyAdapterResult,
  createEmptyConfigurationArtifact,
  createEmptyEnvironmentArtifact,
  createEmptyFunctionArtifact,
  createEmptyRuntimeArtifact,
  createEmptyValidationArtifact,
  type AdapterConfigurationArtifact,
  type AdapterDetectionResult,
  type AdapterEnvironmentArtifact,
  type AdapterFunctionArtifact,
  type AdapterResult,
  type AdapterRuntimeArtifact,
  type AdapterValidationArtifact,
} from './AdapterResult.js';
export {
  BasePlatformAdapter,
  type PlatformAdapter,
} from './PlatformAdapter.js';
export { NetlifyAdapter } from './netlify/NetlifyAdapter.js';
export { VercelAdapter } from './vercel/VercelAdapter.js';
export { AwsLambdaAdapter } from './aws/AwsLambdaAdapter.js';
