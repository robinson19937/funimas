import type { AdapterContext } from './AdapterContext.js';
import { AwsLambdaAdapter } from './aws/AwsLambdaAdapter.js';
import { NetlifyAdapter } from './netlify/NetlifyAdapter.js';
import type { PlatformAdapter } from './PlatformAdapter.js';
import { VercelAdapter } from './vercel/VercelAdapter.js';

export interface AdapterRegistryDetectionResult {
  adapter?: PlatformAdapter;
  detected: boolean;
}

export interface AdapterRegistryService {
  register(adapter: PlatformAdapter): void;
  registerMany(adapters: PlatformAdapter[]): void;
  getAdapters(): PlatformAdapter[];
  detect(context: AdapterContext): Promise<AdapterRegistryDetectionResult>;
  getAdapter(id: string): PlatformAdapter | undefined;
}

/**
 * Registro extensible de adaptadores de plataforma con detección automática.
 */
export class AdapterRegistry implements AdapterRegistryService {
  private readonly adapters: PlatformAdapter[] = [];

  register(adapter: PlatformAdapter): void {
    this.adapters.push(adapter);
  }

  registerMany(adapters: PlatformAdapter[]): void {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  getAdapters(): PlatformAdapter[] {
    return [...this.adapters];
  }

  getAdapter(id: string): PlatformAdapter | undefined {
    return this.adapters.find((adapter) => adapter.id === id);
  }

  async detect(context: AdapterContext): Promise<AdapterRegistryDetectionResult> {
    for (const adapter of this.adapters) {
      const detection = await adapter.detect(context);

      if (detection.detected) {
        return {
          adapter,
          detected: true,
        };
      }
    }

    return {
      detected: false,
    };
  }
}

export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();

  registry.registerMany([new NetlifyAdapter(), new VercelAdapter(), new AwsLambdaAdapter()]);

  return registry;
}
