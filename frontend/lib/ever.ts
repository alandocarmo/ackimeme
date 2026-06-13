import { ProviderRpcClient } from "everscale-inpage-provider";
import { EverscaleStandaloneClient } from "everscale-standalone-client";

let everInstance: ProviderRpcClient | null = null;
let initializationPromise: Promise<ProviderRpcClient> | null = null;

/**
 * Singleton to get or initialize the Everscale Provider.
 * Avoids loading the provider repeatedly across different components.
 */
export async function getEver(): Promise<ProviderRpcClient> {
  if (everInstance) {
    try {
      if (!(await everInstance.hasProvider())) {
        everInstance = null;
        initializationPromise = null;
      }
    } catch {
      everInstance = null;
      initializationPromise = null;
    }
    if (everInstance) {
      return everInstance;
    }
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        const provider = new ProviderRpcClient({
          fallback: () => EverscaleStandaloneClient.create({
            connection: {
              id: 1,
              type: 'graphql',
              data: { endpoints: [process.env.NEXT_PUBLIC_GRAPHQL_URL || 'https://shellnet.ackinacki.org/graphql'] }
            },
          }),
        } as any);
        
        await provider.ensureInitialized();
        everInstance = provider;
        return everInstance;
      } catch (err) {
        initializationPromise = null;
        throw err;
      }
    })();
  }

  return initializationPromise;
}

export async function hasExtension(): Promise<boolean> {
  const provider = new ProviderRpcClient();
  return await provider.hasProvider();
}
