export const ADAPTER_FEATURES = [
  'runtime',
  'functions',
  'edge-functions',
  'scheduled-functions',
  'environment',
  'configuration',
  'lambda',
  'api-gateway',
] as const;

export type AdapterFeature = (typeof ADAPTER_FEATURES)[number];

export const ADAPTER_FEATURE_LABELS: Record<AdapterFeature, string> = {
  runtime: 'Runtime',
  functions: 'Functions',
  'edge-functions': 'Edge Functions',
  'scheduled-functions': 'Scheduled Functions',
  environment: 'Environment',
  configuration: 'Configuration',
  lambda: 'Lambda',
  'api-gateway': 'API Gateway',
};

export interface AdapterCapabilitiesData {
  platform: string;
  features: AdapterFeature[];
}

/**
 * Describe las capacidades soportadas por un adaptador de plataforma.
 */
export class AdapterCapabilities {
  readonly platform: string;
  private readonly features: ReadonlySet<AdapterFeature>;

  constructor(data: AdapterCapabilitiesData) {
    this.platform = data.platform;
    this.features = new Set(data.features);
  }

  supports(feature: AdapterFeature): boolean {
    return this.features.has(feature);
  }

  getSupportedFeatures(): AdapterFeature[] {
    return ADAPTER_FEATURES.filter((feature) => this.features.has(feature));
  }

  getDisplayFeatures(): string[] {
    return this.getSupportedFeatures().map((feature) => ADAPTER_FEATURE_LABELS[feature]);
  }
}
