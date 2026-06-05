import { ProviderRpcClient } from "everscale-inpage-provider";

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
        const provider = new ProviderRpcClient();
        if (!(await provider.hasProvider())) {
          throw new Error("error_install_wallet");
        }
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
