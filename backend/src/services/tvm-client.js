const { config } = require("../config");

let tvmCore = null;
let _clientInstance = null;
let sdkAvailable = false;

try {
  tvmCore = require("@tvmsdk/core");
  // CRÍTICO: Usar lib-web (WASM) no backend em vez de lib-node (C++) 
  // para evitar problemas de compatibilidade com Node 22 no Render
  const { libWeb } = require("@tvmsdk/lib-web");
  tvmCore.TvmClient.useBinaryLibrary(libWeb);
  sdkAvailable = true;
} catch (e) {
  console.warn("[TvmClient] SDK Core não disponível.", e.message);
}

function getTvmClient() {
  if (!sdkAvailable) return null;
  
  if (!_clientInstance) {
    if (!config.graphqlUrl) {
      console.warn("[TvmClient] ⚠️ GRAPHQL_URL não configurada! SDK conectado a shellnet (testnet).");
    }
    _clientInstance = new tvmCore.TvmClient({
      network: {
        endpoints: [config.graphqlUrl || "https://shellnet.ackinacki.org/graphql"],
      },
    });
  }
  return _clientInstance;
}

function getTvmCore() {
  return tvmCore;
}

module.exports = {
  getTvmClient,
  getTvmCore,
  sdkAvailable
};
