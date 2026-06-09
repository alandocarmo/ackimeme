import { useState, useEffect, useCallback } from "react";
import { getEver } from "../lib/ever";
import { BondingCurveAbi } from "../lib/abi";
import { Launch } from "../types";
import { nanoToDecimal } from "../lib/utils";
import { BondingCurveMethods, TypedContract } from "../types/contracts";

export function useOnchainPrice(token: Launch | null) {
  const [onchainPrice, setOnchainPrice] = useState<number | null>(null);

  const fetchPrice = useCallback(async () => {
    if (!token?.onchainData?.bondingCurveAddress || token.onchainData.deployStatus !== "deployed") return;
    
    try {
      const ever = await getEver();
      const { Address } = await import("everscale-inpage-provider");

      const bc = new ever.Contract(BondingCurveAbi, new Address(token.onchainData.bondingCurveAddress)) as unknown as TypedContract<BondingCurveMethods>;
      
      const oneTokenNano = "1000000000";
      const buyPriceRes = await bc.methods.getBuyPrice({ tokenAmount: oneTokenNano }).call();
      if (buyPriceRes?.value0) {
        setOnchainPrice(nanoToDecimal(buyPriceRes.value0) || null);
      }
    } catch {
      // Provider not available — use fallback
    }
  }, [token?.onchainData?.bondingCurveAddress, token?.onchainData?.deployStatus]);

  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  return { onchainPrice, fetchPrice };
}
