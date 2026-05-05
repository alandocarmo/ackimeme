const { config } = require("../config");

let tvmCore = null;
let _clientInstance = null;
let sdkAvailable = false;

// P0 FIX: lib-web é ESM-only e causa "Unexpected token 'export'" com require().
// lib-node é o binding correto para Node.js (C++ addon).
// Fallback chain: lib-node (sync) — lib-web não é suportado em CJS.
try {
  tvmCore = require("@tvmsdk/core");

  // lib-node é o binding C++ nativo para Node.js
  const { libNode } = require("@tvmsdk/lib-node");
  tvmCore.TvmClient.useBinaryLibrary(libNode);
  sdkAvailable = true;
  console.log("[TvmClient] SDK inicializado com lib-node (nativo).");
} catch (e) {
  console.warn("[TvmClient] SDK TVM não carregou:", e.message);
  console.error(
    "[TvmClient] ⚠️ Deploy on-chain e sync ficarão indisponíveis. " +
    "Verifique se @tvmsdk/core e @tvmsdk/lib-node estão instalados e compatíveis com esta versão do Node."
  );
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
