const { config } = require("../config");
const fs = require("fs");
const path = require("path");

let tvmCore = null;
let _clientInstance = null;
let sdkAvailable = false;

function loadLibNode() {
  const configuredBinary = String(process.env.TVM_SDK_NODE_BINARY || "").trim();
  if (configuredBinary) {
    if (!fs.existsSync(configuredBinary)) {
      throw new Error(`TVM_SDK_NODE_BINARY não encontrado: ${configuredBinary}`);
    }
    return () => require(configuredBinary);
  }

  const { libNode } = require("@tvmsdk/lib-node");
  const packageDir = path.dirname(require.resolve("@tvmsdk/lib-node"));
  const packageBinaryTvm = path.join(packageDir, "tvmsdk.node");
  
  if (!fs.existsSync(packageBinaryTvm)) {
    throw new Error(
      "tvmsdk.node não encontrado em @tvmsdk/lib-node. " +
        "Compile o binding Acki Nacki conforme o Quick Start oficial e defina TVM_SDK_NODE_BINARY.",
    );
  }
  return libNode;
}

// P0 FIX: lib-web é ESM-only e causa "Unexpected token 'export'" com require().
// lib-node é o binding correto para Node.js (C++ addon).
// Fallback chain: lib-node (sync) — lib-web não é suportado em CJS.
try {
  const tvmsdkCore = require("@tvmsdk/core");
  tvmCore = tvmsdkCore;
  // Shim for backward compatibility with the rest of the app expecting TvmClient
  tvmCore.TvmClient = tvmsdkCore.TvmClient;

  // lib-node é o binding C++ nativo para Node.js.
  const libNode = loadLibNode();
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
    try {
      _clientInstance = new tvmCore.TvmClient({
        network: {
          endpoints: [config.graphqlUrl || "https://shellnet.ackinacki.org/graphql"],
        },
      });
    } catch (e) {
      console.warn("[TvmClient] Falha ao inicializar TvmClient:", e.message);
      sdkAvailable = false;
      return null;
    }
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
