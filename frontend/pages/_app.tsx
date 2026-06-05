import Head from "next/head";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/router";
import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import { getSession } from "../lib/api";
import ErrorBoundary from "../lib/ErrorBoundary";
import { I18nProvider, useI18n, SUPPORTED_LANGS } from "../lib/i18n";
import type { AppProps } from "next/app";
import type { Session } from "../types";
import styles from "../styles/GlobalNav.module.css";

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

function GlobalNav({ session }: { session: Session | null }) {
  const router = useRouter();
  const isAuth = router.pathname === "/auth";
  const { t } = useI18n();

  return (
    <nav className={styles.navbar}>
      <div className={styles.navLeft}>
        <Link href="/" className={styles.navBrand}>
          <span className={styles.navBrandIcon}>⬡</span>
          <span className={styles.navBrandText}>AckiMeme</span>
        </Link>
        <span className={styles.navNetworkTag}>Acki Nacki</span>
      </div>
      <div className={styles.navRight}>
        <Link href="/" className={styles.navLink} aria-current={router.pathname === "/" ? "page" : undefined}>
          {t("nav_board")}
        </Link>
        <Link href="/portfolio" className={styles.navLink} aria-current={router.pathname === "/portfolio" ? "page" : undefined}>
          {t("nav_portfolio")}
        </Link>
        <Link href="/create" className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }} aria-current={router.pathname === "/create" ? "page" : undefined}>
          {t("nav_create")}
        </Link>
        <LanguageSwitcher />
        {session ? (
          <>
            <div className="badge-verifier" title="Bee Engine Verifier Status">
              <span className="badge-verifier-icon">🐝</span>
              Novice Node
            </div>
            <Link href="/auth" className={styles.walletBadge}>
              <span className={styles.walletDot} />
              {session.walletAddress.slice(0, 6)}…{session.walletAddress.slice(-4)}
            </Link>
          </>
        ) : !isAuth ? (
          <Link href="/auth" className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent-glow)' }}>
            {t("nav_connect")}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Telegram WebApp SDK — notifica o Telegram que o Mini App carregou
    // e expande para tela cheia. Sem isso, o spinner do Telegram fica eterno.
      if ((window.Telegram as any)?.WebApp) {
        (window.Telegram as any).WebApp.ready();
        (window.Telegram as any).WebApp.expand();
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
        <title>AckiMeme</title>
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
