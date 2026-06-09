const fs = require('fs');

const file = 'frontend/pages/token/[id].tsx';
let content = fs.readFileSync(file, 'utf8');

const returnIdx = content.indexOf('return (\n    <>\n      <Head>');
if (returnIdx === -1) {
  console.error("Could not find component return!");
  process.exit(1);
}

const jsxPart = "  " + content.substring(returnIdx);

const newTop = `import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { getSession } from "../../lib/api";
import { useToast } from "../../lib/useToast";
import { formatNum, getSlopeLabel, formatSupply, compactWallet, isSafeUrl, formatDate, toNano, nanoToDecimal, hashColor, calcBondingStats } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";
import styles from "../../styles/Token.module.css";
import type { Session, Launch } from "../../types";

import PriceChart from "../../components/PriceChart";
import BubbleMap from "../../components/BubbleMap";
import TradingChart from "../../components/TradingChart";
import TokenHeader from "../../components/token/TokenHeader";
import TokenChat from "../../components/token/TokenChat";
import TokenTradingPanel from "../../components/token/TokenTradingPanel";
import SEO from "../../components/SEO";
import Skeleton from "../../components/ui/Skeleton";
import { ToastContainer } from "../../components/ui/ToastContainer";

import { useTokenData } from "../../hooks/useTokenData";
import { useOnchainPrice } from "../../hooks/useOnchainPrice";
import { useTrading } from "../../hooks/useTrading";
import { useBalances } from "../../hooks/useBalances";
import { useFavorite } from "../../hooks/useFavorite";

export default function TokenPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { id } = router.query;
  const idStr = Array.isArray(id) ? id[0] : id as string;

  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    getSession().then((r) => setSession(r.session)).catch(() => {});
  }, []);

  const { token, loading, error, comments, trades, holders, totalSupply, priceHistory, handleCommentPosted } = useTokenData(idStr);
  const { isFavorite, handleToggleFavorite } = useFavorite(session, idStr);
  const { onchainPrice } = useOnchainPrice(token);
  
  const {
    tradeMode, setTradeMode,
    tradeAmount, setTradeAmount,
    slippage, setSlippage,
    isTrading, tradeSuccess, error: tradeError,
    buyReturn, sellReturn,
    handleTrade, TRADE_FEE_BPS
  } = useTrading(session, token, onchainPrice, t);

  const { userShellEccBalance, userTokenBalance } = useBalances(session, token, tradeSuccess);

  const [chartTab, setChartTab] = useState<"theory" | "live">("theory");
  const [selectedInterval, setSelectedInterval] = useState<number>(15);

  const memoizedEstimate = useMemo(() => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      return { value: "0.00", fee: null, impact: null };
    }
    
    if (tradeMode === "buy") {
      const tokensOut = buyReturn !== null ? buyReturn : 0;
      let impact = null;
      if (onchainPrice && onchainPrice > 0) {
         const expectedTokensWithoutImpact = parseFloat(tradeAmount) / onchainPrice;
         if (expectedTokensWithoutImpact > 0) {
           impact = Math.max(0, ((expectedTokensWithoutImpact - tokensOut) / expectedTokensWithoutImpact) * 100);
         }
      }
      return { 
        value: tokensOut > 0 ? tokensOut.toFixed(2) : "aguardando...", 
        fee: (parseFloat(tradeAmount) * (TRADE_FEE_BPS / 10000)).toFixed(4),
        impact 
      };
    } else {
      const shellOut = sellReturn !== null ? sellReturn : 0;
      let impact = null;
      if (onchainPrice && onchainPrice > 0) {
         const expectedShellWithoutImpact = parseFloat(tradeAmount) * onchainPrice;
         if (expectedShellWithoutImpact > 0) {
           impact = Math.max(0, ((expectedShellWithoutImpact - shellOut) / expectedShellWithoutImpact) * 100);
         }
      }
      return { 
        value: shellOut > 0 ? shellOut.toFixed(4) : "aguardando...", 
        fee: (shellOut * (TRADE_FEE_BPS / 10000)).toFixed(4),
        impact 
      };
    }
  }, [tradeAmount, tradeMode, onchainPrice, buyReturn, sellReturn, TRADE_FEE_BPS]);

  if (!router.isReady) return null;

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>{t("common_loading")}</p>
      </div>
    );
  }

  const showMissingTokenCta = Boolean(error) && !loading && !token;

  if (showMissingTokenCta || !token) {
    return (
      <div className={styles.errorContainer}>
        <h2 className={styles.errorTitle}>Not Found</h2>
        <p className={styles.errorMessage}>{error || "Token was not found or failed to load."}</p>
        <Link href="/" className={\`btn btn-primary \${styles.homeLink}\`}>
          {t("nav_home")}
        </Link>
      </div>
    );
  }

  const stats = token.onchainData ? calcBondingStats(token.onchainData) : { progressPct: "0", hasOnchainReserve: false, reserveShell: 0, reserveRatio: 0, totalValueLocked: 0, tokenSupplyRaw: "0" };
  const color = hashColor(token.coin?.symbol || "");

`;

fs.writeFileSync(file, newTop + jsxPart);
console.log("Refactoring complete");
