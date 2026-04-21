const fs = require("fs");
const path = require("path");
const { listPublicLaunches, listLaunchesForSync, updateLaunchOnchainState } = require("../storage");
const { getAccountPublicKey } = require("./graphql.service");
const { config } = require("../config");

// TVM SDK Initialization for local BOC decoding
// Wrapped in try/catch to prevent backend crash if SDK is not installed
let tvmCore = null;
let client = null;
try {
  tvmCore = require("@tvmsdk/core");
  const { libNode } = require("@tvmsdk/lib-node");
  tvmCore.TvmClient.useBinaryLibrary(libNode);
  client = new tvmCore.TvmClient({
    network: {
      endpoints: [config.graphqlUrl || "https://shellnet.ackinacki.org/graphql"],
    },
  });
} catch (err) {
  console.warn("[SyncJob] TVM SDK indisponível. On-chain sync disabled.", err.message);
}

// ABI Cache to avoid disk I/O in loop
const ABI_DIR = path.join(__dirname, "../abi");
const bondingCurveAbiPath = path.join(ABI_DIR, "BondingCurve.abi.json");
const tokenRootAbiPath = path.join(ABI_DIR, "TokenRoot.abi.json");
const abiCache = new Map();

function getCachedAbi(abiPath) {
  if (abiCache.has(abiPath)) return abiCache.get(abiPath);
  if (!fs.existsSync(abiPath) || !tvmCore) return null;
  try {
    const abi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    const contract = tvmCore.abiContract(abi);
    abiCache.set(abiPath, contract);
    return contract;
  } catch (err) {
    console.error(`[SyncJob] Error loading ABI at ${abiPath}:`, err.message);
    return null;
  }
}

/**
 * Executes a getter function locally using the contract's BOC.
 */
async function runLocalGetter(boc, address, abiPath, functionName) {
  if (!client) return null;
  const abi = getCachedAbi(abiPath);
  if (!abi) return null;
  
  try {
    const encoded = await client.abi.encode_message({
      abi,
      call_set: { function_name: functionName },
      signer: { type: 'None' },
      address: address
    });

    const result = await client.tvm.run_tvm({
      message: encoded.message,
      account: boc,
      abi,
    });
    
    return result.decoded.output;
  } catch (err) {
    // Silently handle errors for specific token instances to not break the whole job
    return null;
  }
}

/**
 * Main routine. Iterates on-chain deployed tokens and retrieves current
 * reserveBalance, tokenSupply and migrated (locked) status directly from Blockchain.
 */
async function syncOnchainData() {
  try {
    // R-09: Limit batch to 10 tokens per cycle to prevent GraphQL saturation.
    // Each token makes 2-3 GraphQL calls, so 10 tokens = ~30 requests max per cycle.
    // With the default limit of 30, that's ~90 requests which can overwhelm the API.
    const SYNC_BATCH_SIZE = 10;
    const launches = await listLaunchesForSync(SYNC_BATCH_SIZE);
    let updatedCount = 0;
    
    for (const launch of launches) {
      if (launch.status !== "on_chain_deployed" || !launch.bondingCurveAddress) {
        continue;
      }

      const bcState = await getAccountPublicKey(launch.bondingCurveAddress);
      
      if (bcState.isDeployed && bcState.boc) {
        // Fallbacks
        let reserveBalance = "0"; // H-32: Fallback corrected to ZERO, not gas balance
        let tokenSupply = launch.launchRequest?.coin?.totalSupply || "0";
        let lockedLiquidity = launch.lockedLiquidity || false;

        // Run Local Getters with BondingCurve BOC
        const reserveOut = await runLocalGetter(bcState.boc, launch.bondingCurveAddress, bondingCurveAbiPath, "reserveBalance");
        if (reserveOut && reserveOut.reserveBalance) {
          reserveBalance = reserveOut.reserveBalance;
        }

        const migratedOut = await runLocalGetter(bcState.boc, launch.bondingCurveAddress, bondingCurveAbiPath, "migrated");
        if (migratedOut && migratedOut.migrated !== undefined) {
          lockedLiquidity = migratedOut.migrated;
        }

        const failedOut = await runLocalGetter(bcState.boc, launch.bondingCurveAddress, bondingCurveAbiPath, "migrationFailed");
        let status = launch.status;
        if (failedOut && failedOut.migrationFailed) {
          status = "trading_halted_migration_failure";
        }

        // Run Local Getters with TokenRoot BOC
        if (launch.tokenRootAddress) {
          const rootState = await getAccountPublicKey(launch.tokenRootAddress);
          if (rootState.isDeployed && rootState.boc) {
             const supplyOut = await runLocalGetter(rootState.boc, launch.tokenRootAddress, tokenRootAbiPath, "totalSupply");
             if (supplyOut && supplyOut.totalSupply) {
               tokenSupply = supplyOut.totalSupply;
             }
          }
        }

        await updateLaunchOnchainState(launch.id, {
          reserveBalance: reserveBalance.toString(),
          tokenSupply: tokenSupply.toString(),
          lockedLiquidity,
          status
        });
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.log(`[SyncJob] Sincronização concluída: ${updatedCount} tokens atualizados.`);
    }
  } catch (e) {
    console.error(`[SyncJob] Erro durante o ciclo de sincronização: ${e.message}`);
  }
}

let syncTimer = null;
let isSyncRunning = false;

function startSyncJob(intervalMs = 120_000) { // R-09: Increased from 60s to 120s
  if (syncTimer) return;
  console.log("[SyncJob] Background on-chain data synchronizer started (Recursive Timeout).");

  async function scheduleNext() {
    if (isSyncRunning) return;
    isSyncRunning = true;
    
    try {
      await syncOnchainData();
    } finally {
      isSyncRunning = false;
      syncTimer = setTimeout(scheduleNext, intervalMs);
    }
  }

  scheduleNext();
}

function stopSyncJob() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
    console.log("[SyncJob] Synchronizer stopped.");
  }
}

module.exports = { startSyncJob, stopSyncJob, syncOnchainData };
