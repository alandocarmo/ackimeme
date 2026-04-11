import "../styles/globals.css";
import Link from "next/link";
import { useRouter } from "next/router";
import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import { getSession } from "../lib/api";

const SESSION_STORAGE_KEY = "ackimeme_session_token";

// Lista de wallets admin (sync com backend ADMIN_WALLETS env)
// Lida do env publico para nao expor no server side
const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || "")
  .split(",")
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean);

function GlobalNav({ session, isAdmin }) {
  const router = useRouter();
  const isHome = router.pathname === "/";
  const isAuth = router.pathname === "/auth";

  return (
    <nav style={navStyles.bar}>
      <div style={navStyles.left}>
        <Link href="/" style={navStyles.brand}>⬡ AckiMeme</Link>
        <span style={navStyles.networkTag}>Acki Nacki</span>
      </div>
      <div style={navStyles.right}>
        {!isHome && (
          <Link href="/#market-feed" style={navStyles.link}>/board</Link>
        )}
        <Link href="/exclusive" style={navStyles.link}>/launchpad</Link>
        {/* Admin tab: ONLY visible if wallet is recognised as admin */}
        {isAdmin && (
          <Link href="/admin" style={navStyles.adminLink}>/admin</Link>
        )}
        {session ? (
          <span style={navStyles.walletBadge}>
            {session.walletAddress.slice(0, 6)}...{session.walletAddress.slice(-4)}
          </span>
        ) : !isAuth ? (
          <Link href="/auth" style={navStyles.connectBtn}>[ connect wallet ]</Link>
        ) : null}
      </div>
    </nav>
  );
}

export default function App({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!token) return;

    getSession(token)
      .then((res) => {
        setSession(res.session);
        // Verificação local silenciosa — sem expor endpoint admin
        const wallet = (res.session?.walletAddress || "").toLowerCase();
        if (ADMIN_WALLETS.length > 0 && ADMIN_WALLETS.includes(wallet)) {
          setIsAdmin(true);
        }
      })
      .catch(() => {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      });
  }, []);

  return (
    <>
      <GlobalNav session={session} isAdmin={isAdmin} />
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}

const navStyles = {
  bar: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 20px",
    height: "52px",
    background: "rgba(9,9,11,0.92)",
    borderBottom: "1px solid #27272a",
    backdropFilter: "blur(12px)",
    fontFamily: '"ui-monospace","SFMono-Regular","Menlo","Monaco",monospace',
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  brand: {
    color: "#86efac",
    fontWeight: "bold",
    fontSize: "15px",
    textDecoration: "none",
    letterSpacing: "-0.02em",
  },
  networkTag: {
    fontSize: "10px",
    color: "#3f3f46",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    paddingLeft: "8px",
    borderLeft: "1px solid #27272a",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  link: {
    color: "#71717a",
    fontSize: "12px",
    textDecoration: "none",
    letterSpacing: "0.04em",
  },
  adminLink: {
    color: "#f97316",
    fontSize: "12px",
    fontWeight: "bold",
    textDecoration: "none",
    letterSpacing: "0.04em",
    border: "1px solid rgba(249,115,22,0.3)",
    padding: "3px 8px",
    borderRadius: "2px",
  },
  connectBtn: {
    color: "#86efac",
    fontSize: "12px",
    fontWeight: "bold",
    textDecoration: "none",
    border: "1px solid rgba(134,239,172,0.4)",
    padding: "5px 10px",
    borderRadius: "2px",
  },
  walletBadge: {
    color: "#a1a1aa",
    fontSize: "11px",
    background: "#27272a",
    padding: "4px 8px",
    borderRadius: "2px",
  },
};
