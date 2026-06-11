import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { listLaunchesForSync, updateLaunchOnchainState, insertTrade } from "../storage";
import { getAccountState, getRecentBondingCurveTrades } from "./graphql.service";
import { getTvmClient, getTvmCore, sdkAvailable } from "./tvm-client";

let tvmCore: any = null;
let client: any = null;
let ioInstance: any = null;

export function setSocketIo(io: any) {
  ioInstance = io;
}

if (sdkAvailable) {
  tvmCore = getTvmCore();
  client = getTvmClient();
} else {
  console.warn("[SyncJob] TVM SDK indisponível. On-chain sync disabled.");
}

// ABI Cache to avoid disk I/O in loop
const ABI_DIR = path.join(__dirname, "../abi");
const bondingCurveAbiPath = path.join(ABI_DIR, "BondingCurve.abi.json");
const tokenRootAbiPath = path.join(ABI_DIR, "TokenRoot.abi.json");
const abiCache = new Map<string, any>();

function getCachedAbi(abiPath: string): any {
  if (abiCache.has(abiPath)) return abiCache.get(abiPath);
  if (!fs.existsSync(abiPath) || !tvmCore) return null;
  try {
    const abi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    const contract = tvmCore.abiContract(abi);
    abiCache.set(abiPath, contract);
    return contract;
  } catch (err: any) {
    console.error(`[SyncJob] Error loading ABI at ${abiPath}:`, err.message);
    return null;
  }
}

async function runLocalGetter(boc: string, address: string, abiPath: string, functionName: string): Promise<any> {
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
  } catch (err: any) {
    if (!err.message?.includes("account not found")) {
      console.warn(`[SyncJob] runLocalGetter ${functionName} @ ${address}: ${err.message}`);
    }
    return null;
  }
}

export async function syncOnchainData(): Promise<void> {
  try {
    // R-09: Limit batch to 10 tokens per cycle to prevent GraphQL saturation.
    const SYNC_BATCH_SIZE = 10;
    const launches = await listLaunchesForSync(SYNC_BATCH_SIZE);
    let updatedCount = 0;
    
    const results = await Promise.allSettled(
      launches.map(async (launch) => {
        if (!launch) return;
        if (!["on_chain_deployed", "on_chain_pending_recovery", "deployment_queued"].includes(launch.status) || !launch.bondingCurveAddress) {
          return;
        }

        const bcState = await getAccountState(launch.bondingCurveAddress);
        
        if (bcState.isDeployed && bcState.boc) {
          // Fallbacks
          let reserveBalance = "0"; // H-32: Fallback corrected to ZERO, not gas balance
          let tokenSupply: string | null = null; // Audit #23: Do not default to cap if getter fails, use null to indicate sync gap
          let lockedLiquidity = launch.onchainData?.lockedLiquidity || false;

          // Run Local Getters with BondingCurve BOC
          const reserveOut = await runLocalGetter(bcState.boc, launch.bondingCurveAddress, bondingCurveAbiPath, "reserveBalance");
          if (reserveOut && reserveOut.reserveBalance) {
            reserveBalance = reserveOut.reserveBalance;
          }

          // A-04: BondingCurve was refactored to internal AMM — getter is `isAmm`, not `migrated`
          const ammOut = await runLocalGetter(bcState.boc, launch.bondingCurveAddress, bondingCurveAbiPath, "isAmm");
          if (ammOut && ammOut.isAmm !== undefined) {
            lockedLiquidity = ammOut.isAmm;
          }

          let aftWalletOut = await runLocalGetter(bcState.boc, launch.bondingCurveAddress, bondingCurveAbiPath, "myAftWallet");
          let hasAftWallet = false;
          if (aftWalletOut && aftWalletOut.myAftWallet && aftWalletOut.myAftWallet !== "0:0000000000000000000000000000000000000000000000000000000000000000") {
            hasAftWallet = true;
          } else {
             console.warn(`[SyncJob] BondingCurve ${launch.bondingCurveAddress} is missing myAftWallet! Race condition triggered. A manual retry of initAftWallet is required.`);
          }

          let status = ["on_chain_pending_recovery", "deployment_queued"].includes(launch.status) ? "on_chain_deployed" : launch.status;
          
          if (!hasAftWallet && status === "on_chain_deployed") {
             // Keep it as pending recovery so frontend knows it's not fully ready
             status = "on_chain_pending_recovery";
          }

          // Run Local Getters with TokenRoot BOC
          if (launch.tokenRootAddress) {
            const rootState = await getAccountState(launch.tokenRootAddress);
            if (rootState.isDeployed && rootState.boc) {
               const supplyOut = await runLocalGetter(rootState.boc, launch.tokenRootAddress, tokenRootAbiPath, "getAftData");
               if (supplyOut && supplyOut.totalSupply) {
                 tokenSupply = supplyOut.totalSupply;
               }
            }
          }

          await updateLaunchOnchainState(launch.id, {
            reserveBalance: reserveBalance.toString(),
            tokenSupply: tokenSupply !== null ? tokenSupply.toString() : launch.onchainData?.tokenSupply,
            lockedLiquidity,
            status,
            deployStatus: "deployed",
            deployReason: "",
          });
          
          if (ioInstance) {
            ioInstance.to(`token_${launch.id}`).emit("token_updated", {
              id: launch.id,
              reserveBalance: reserveBalance.toString(),
              tokenSupply: tokenSupply !== null ? tokenSupply.toString() : launch.onchainData?.tokenSupply,
              lockedLiquidity,
              status,
              updatedAt: new Date().toISOString()
            });
          }
          
          // [New] Index Recent Trades
          try {
            // Paginação: Usando apenas a primeira página para o sync recorrente
            const { trades } = await getRecentBondingCurveTrades(launch.bondingCurveAddress);
            // Prepare trades (oldest first for chronological ordering)
            const preparedTrades = trades.reverse().map((trade: any) => ({
              ...trade,
              launchId: launch.id,
              id: crypto.randomUUID(),
            }));
            const insertedTrades = await Promise.all(
              preparedTrades.map((trade: any) => insertTrade(trade))
            );
            for (const newTrade of insertedTrades) {
              if (newTrade && ioInstance) {
                ioInstance.to(`token_${launch.id}`).emit("new_trade", newTrade);
              }
            }
          } catch (err: any) {
            console.error(`[SyncJob] Error syncing trades for launch ${launch.id}:`, err.message);
          }
          
          updatedCount++;
        } else {
          // Token is not deployed yet. Bump the sync cursor so it doesn't starve the queue.
          await updateLaunchOnchainState(launch.id, {
            reserveBalance: launch.onchainData?.reserveBalance || "0",
            tokenSupply: launch.onchainData?.tokenSupply,
            lockedLiquidity: launch.onchainData?.lockedLiquidity || false,
            status: launch.status,
            deployStatus: launch.onchainData?.deployStatus || "pending",
            deployReason: launch.onchainData?.deployReason || "",
          });
        }
      })
    );

    results.forEach(r => {
      if (r.status === 'rejected') {
        console.error(`[SyncJob] Error syncing launch: ${r.reason}`);
      }
    });

    if (updatedCount > 0) {
      console.log(`[SyncJob] Sincronização concluída: ${updatedCount} tokens atualizados.`);
    }
  } catch (e: any) {
    console.error(`[SyncJob] Erro durante o ciclo de sincronização: ${e.message}`);
  }
}

let syncTimer: NodeJS.Timeout | null = null;
let isSyncRunning = false;

export function startSyncJob(intervalMs = 120_000): void { // R-09: Increased from 60s to 120s
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

export function stopSyncJob(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
    console.log("[SyncJob] Synchronizer stopped.");
  }
}
