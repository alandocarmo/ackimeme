import "../styles/globals.css";
import Link from "next/link";
import { useRouter } from "next/router";
import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import { getSession } from "../lib/api";

const SESSION_STORAGE_KEY = "ackimeme_session_token";



function GlobalNav({ session, isAdmin }) {
  const router = useRouter();
  const isAuth = router.pathname === "/auth";

  return (
    <nav style={nav.bar}>
      <div style={nav.left}>
        <Link href="/" style={nav.brand}>
          <span style={nav.brandIcon}>⬡</span>
          <span style={nav.brandText}>AckiMeme</span>
        </Link>
        <span style={nav.networkTag}>Acki Nacki</span>
      </div>
      <div style={nav.right}>
        <Link href="/" style={nav.link}>
          <span style={nav.linkIcon}>◈</span> Board
        </Link>
        <Link href="/create" style={nav.createBtn}>
          🚀 Create Coin
        </Link>
        {session ? (
          <Link href="/auth" style={nav.walletBadge}>
            <span style={nav.walletDot} />
            {session.walletAddress.slice(0, 6)}…{session.walletAddress.slice(-4)}
          </Link>
        ) : !isAuth ? (
          <Link href="/auth" style={nav.connectBtn}>Connect</Link>
        ) : null}
      </div>
    </nav>
  );
}

export default function App({ Component, pageProps }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!token) return;

    getSession(token)
      .then((res) => {
        setSession(res.session);
      })
      .catch(() => {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      });
  }, []);

  return (
    <>
      <GlobalNav session={session} />
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}

const nav = {
  bar: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    height: "56px",
    background: "rgba(9,9,11,0.85)",
    borderBottom: "1px solid rgba(39,39,42,0.6)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    fontFamily: 'var(--font-sans)',
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textDecoration: "none",
  },
  brandIcon: {
    color: "#00ff88",
    fontSize: "20px",
    filter: "drop-shadow(0 0 6px rgba(0,255,136,0.4))",
  },
  brandText: {
    color: "#f4f4f5",
    fontWeight: 700,
    fontSize: "16px",
    letterSpacing: "-0.03em",
  },
  networkTag: {
    fontSize: "9px",
    color: "#3f3f46",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    paddingLeft: "12px",
    borderLeft: "1px solid #27272a",
    fontFamily: "var(--font-mono)",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  link: {
    color: "#71717a",
    fontSize: "13px",
    textDecoration: "none",
    padding: "6px 12px",
    borderRadius: "6px",
    transition: "color 0.15s, background 0.15s",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  linkIcon: {
    fontSize: "10px",
    opacity: 0.6,
  },

  createBtn: {
    color: "#000",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "7px 16px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #00ff88, #00cc6d)",
    boxShadow: "0 0 16px rgba(0,255,136,0.2)",
    transition: "box-shadow 0.2s, transform 0.15s",
    whiteSpace: "nowrap",
  },
  connectBtn: {
    color: "#00ff88",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "6px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(0,255,136,0.3)",
    transition: "background 0.15s",
  },
  walletBadge: {
    color: "#a1a1aa",
    fontSize: "11px",
    background: "rgba(39,39,42,0.6)",
    padding: "5px 10px",
    borderRadius: "6px",
    fontFamily: "var(--font-mono)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    textDecoration: "none",
    border: "1px solid rgba(39,39,42,0.8)",
  },
  walletDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#00ff88",
    boxShadow: "0 0 6px rgba(0,255,136,0.5)",
    display: "inline-block",
  },
};
