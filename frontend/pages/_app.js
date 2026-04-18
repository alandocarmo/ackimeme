import "../styles/globals.css";
import Link from "next/link";
import { useRouter } from "next/router";
import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import { getSession } from "../lib/api";

function GlobalNav({ session, isAdmin }) {
  const router = useRouter();
  const isAuth = router.pathname === "/auth";

  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link href="/" className="nav-brand">
          <span className="nav-brand-icon">⬡</span>
          <span className="nav-brand-text">AckiMeme</span>
        </Link>
        <span className="nav-network-tag">Acki Nacki</span>
      </div>
      <div className="nav-right">
        <Link href="/" className="nav-link">
          ◈ Board
        </Link>
        <Link href="/create" className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>
          🚀 Create
        </Link>
        {session ? (
          <Link href="/auth" className="wallet-badge">
            <span className="wallet-dot" />
            {session.walletAddress.slice(0, 6)}…{session.walletAddress.slice(-4)}
          </Link>
        ) : !isAuth ? (
          <Link href="/auth" className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent-glow)' }}>
            Connect
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export default function App({ Component, pageProps }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    getSession()
      .then((res) => {
        setSession(res.session);
      })
      .catch(() => {
        // Silently fail if cookie is missing
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

