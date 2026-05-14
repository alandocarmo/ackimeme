import "../styles/globals.css";
import Head from "next/head";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/router";
import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import { getSession } from "../lib/api";
import ErrorBoundary from "../lib/ErrorBoundary";
import { I18nProvider, useI18n, SUPPORTED_LANGS } from "../lib/i18n";

function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-deep)', borderRadius: '6px', padding: '2px' }}>
      {SUPPORTED_LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: lang === l.code ? 700 : 400,
            background: lang === l.code ? 'var(--accent)' : 'transparent',
            color: lang === l.code ? '#000' : 'var(--ink-soft)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title={l.label}
        >
          {l.flag}
        </button>
      ))}
    </div>
  );
}

function GlobalNav({ session }) {
  const router = useRouter();
  const isAuth = router.pathname === "/auth";
  const { t } = useI18n();

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
          {t("nav_board")}
        </Link>
        <Link href="/portfolio" className="nav-link">
          {t("nav_portfolio")}
        </Link>
        <Link href="/create" className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>
          {t("nav_create")}
        </Link>
        <LanguageSwitcher />
        {session ? (
          <Link href="/auth" className="wallet-badge">
            <span className="wallet-dot" />
            {session.walletAddress.slice(0, 6)}…{session.walletAddress.slice(-4)}
          </Link>
        ) : !isAuth ? (
          <Link href="/auth" className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent-glow)' }}>
            {t("nav_connect")}
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

    // Telegram WebApp SDK — notifica o Telegram que o Mini App carregou
    // e expande para tela cheia. Sem isso, o spinner do Telegram fica eterno.
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    const fetchSession = () => {
      getSession()
        .then((res) => {
          setSession(res.session);
        })
        .catch(() => {
          setSession(null);
        });
    };

    fetchSession();

    window.addEventListener("session-changed", fetchSession);
    return () => {
      window.removeEventListener("session-changed", fetchSession);
    };
  }, []);

  return (
    <I18nProvider>
      <Head>
        {/* Removed standard script tag from Head */}
      </Head>
      {/* Telegram WebApp SDK — deve ser carregado antes de qualquer interação */}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <GlobalNav session={session} />
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
      <Analytics />
    </I18nProvider>
  );
}
