import { useState, useEffect, useCallback } from "react";
import { getSocket, getLaunchById, getComments, getTrades, getHolders, getPriceHistory } from "../lib/api";
import { Launch, CommentType, Trade, Holder } from "../types";

export function useTokenData(idStr: string) {
  const [token, setToken] = useState<Launch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [comments, setComments] = useState<CommentType[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [priceHistory, setPriceHistory] = useState<Record<string, unknown>[]>([]);

  const fetchToken = useCallback(async () => {
    if (!idStr) return;
    try {
      setLoading(true);
      const data = await getLaunchById(idStr);
      setToken(data);
      setError("");
    } catch (err) {
      setError("Token não encontrado ou erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [idStr]);

  const fetchHistory = useCallback(async () => {
    if (!idStr) return;
    try {
      const r = await getPriceHistory(idStr, 15);
      setPriceHistory(r.history || []);
    } catch (err) {
      console.warn("Error fetching price history", err);
    }
  }, [idStr]);

  useEffect(() => {
    fetchToken();
    fetchHistory();
  }, [fetchToken, fetchHistory]);

  useEffect(() => {
    if (!idStr) return;
    
    getComments(idStr).then((r) => setComments(r.comments || [])).catch(() => {});
    
    getTrades(idStr).then((r) => setTrades(r.trades || [])).catch(() => {});
    
    getHolders(idStr).then((r) => {
      setHolders(r.holders || []);
      if (r.totalSupply) setTotalSupply(r.totalSupply);
    }).catch(() => {});
    
    const socket = getSocket();
    if (!socket) return;

    socket.emit("join_token", idStr);

    const handleTokenUpdated = (update: Partial<Launch>) => {
      setToken((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: update.status || prev.status,
          onchainData: {
            ...prev.onchainData,
            reserveBalance: update.onchainData?.reserveBalance ?? prev.onchainData?.reserveBalance,
            tokenSupply: update.onchainData?.tokenSupply ?? prev.onchainData?.tokenSupply,
            lockedLiquidity: update.onchainData?.lockedLiquidity ?? prev.onchainData?.lockedLiquidity,
            updatedAt: update.onchainData?.updatedAt ?? prev.onchainData?.updatedAt,
          },
        };
      });
    };

    const handleNewComment = (comment: CommentType) => {
      setComments((prev) => {
        if (prev.find((c) => c.id === comment.id)) return prev;
        return [comment, ...prev];
      });
    };

    let holdersTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleNewTrade = (trade: Trade) => {
      setTrades((prev) => {
        if (prev.find((t) => t.id === trade.id)) return prev;
        return [trade, ...prev];
      });
      if (holdersTimeoutId) clearTimeout(holdersTimeoutId);
      holdersTimeoutId = setTimeout(() => {
        getHolders(idStr).then((r) => {
          setHolders(r.holders || []);
          if (r.totalSupply) setTotalSupply(r.totalSupply);
        }).catch(() => {});
      }, 5000);
    };

    const handleConnect = () => {
      socket.emit("join_token", idStr);
    };

    socket.on("connect", handleConnect);
    socket.on("token_updated", handleTokenUpdated);
    socket.on("new_comment", handleNewComment);
    socket.on("new_trade", handleNewTrade);

    return () => {
      if (holdersTimeoutId) clearTimeout(holdersTimeoutId);
      socket.off("connect", handleConnect);
      socket.off("token_updated", handleTokenUpdated);
      socket.off("new_comment", handleNewComment);
      socket.off("new_trade", handleNewTrade);
    };
  }, [idStr]);

  const handleCommentPosted = useCallback((comment: CommentType) => {
    setComments((prev) => [comment, ...prev]);
  }, []);

  return {
    token, loading, error,
    comments, trades, holders, totalSupply, priceHistory,
    handleCommentPosted
  };
}
