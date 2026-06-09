import { useState, useEffect, useCallback } from "react";
import { getWalletBalance } from "../lib/api";
import { getEver } from "../lib/ever";
import { TokenRootAbi, TokenWalletAbi } from "../lib/abi";
import { Session, Launch } from "../types";
import { TokenRootMethods, TokenWalletMethods, TypedContract } from "../types/contracts";
import * as Sentry from "@sentry/nextjs";

export function useBalances(session: Session | null, token: Launch | null, tradeSuccess: string) {
  const [userShellEccBalance, setUserShellEccBalance] = useState<number>(0);
  const [userTokenBalance, setUserTokenBalance] = useState<number>(0);

  const fetchUserBalances = useCallback(async () => {
    if (!session?.walletAddress) return;
    try {
      // 1. Fetch SHELL ECC balance from backend
      const res = await getWalletBalance(session.walletAddress);
      if (res?.success) {
        setUserShellEccBalance(res.shellEccBalance || 0);
      }
      
      // 2. Fetch Token balance directly from contract
      if (token?.onchainData?.tokenRootAddress && token.onchainData.deployStatus === "deployed") {
        let ever;
        try {
          ever = await getEver();
        } catch (e) {
          return;
        }
        const { Address } = await import("everscale-inpage-provider");
        if (ever) {
          const rootContract = new ever.Contract(TokenRootAbi, new Address(token.onchainData.tokenRootAddress)) as unknown as TypedContract<TokenRootMethods>;
          const walletResult = await rootContract.methods.getWalletAddress({ ownerAddress: new Address(session.walletAddress) }).call();
          const tokenWallet = new ever.Contract(TokenWalletAbi, walletResult.walletAddress) as unknown as TypedContract<TokenWalletMethods>;
          const details = await tokenWallet.methods.getDetails({}).call();
          const nanoBal = BigInt(details.balance);
          const whole = nanoBal / BigInt("1000000000");
          const frac = nanoBal % BigInt("1000000000");
          setUserTokenBalance(Number(`${whole}.${String(frac).padStart(9, "0")}`));
        }
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }, [session?.walletAddress, token?.onchainData?.tokenRootAddress, token?.onchainData?.deployStatus]);

  useEffect(() => {
    fetchUserBalances();
  }, [fetchUserBalances, tradeSuccess]);

  return { userShellEccBalance, userTokenBalance, fetchUserBalances };
}
