import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

// ─── Translation Dictionaries ────────────────────────────────────────────────

const translations: Record<string, Record<string, string>> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ENGLISH (default)
  // ═══════════════════════════════════════════════════════════════════════════
  en: {
    // Nav
    nav_board: "◈ Board",
    nav_portfolio: "👜 Portfolio",
    nav_create: "🚀 Create",
    nav_connect: "Connect",

    // Hero
    hero_title_1: "the memecoin launchpad",
    hero_title_2: "on Acki Nacki",
    hero_subtitle: "fair launch · bonding curve · migrates to AMM at 69K SHELL",
    hero_cta: "🚀 Launch your coin",

    // Stats
    stats_tokens_launched: "Tokens Launched",
    stats_shell_locked: "SHELL Locked",
    stats_active_trading: "Active Trading",
    stats_live: "Acki Nacki Live",

    // Filters
    filter_new: "🕐 New",
    filter_trending: "🔥 Trending",
    filter_finishing: "🏁 Finishing",
    filter_hall_of_fame: "🏆 Hall of Fame",
    search_placeholder: "Search tokens…",

    // Token Card
    card_by: "by",
    card_supply: "Supply",
    card_progress: "Progress",
    card_reserve: "Reserve",
    card_amm_live: "AMM LIVE",
    card_boosted: "BOOSTED",
    card_pump_forever: "∞ Pump Forever",
    card_no_tokens: "No tokens launched yet. Be the first!",
    card_slope_label: "Curve",

    // Token Detail
    detail_back: "← Back",
    detail_bonding_curve: "BONDING CURVE (THEORETICAL MODEL)",
    detail_buy: "Buy",
    detail_sell: "Sell",
    detail_amount_shell: "Amount in SHELL",
    detail_amount_tokens: "Token amount",
    detail_slippage: "Slippage",
    detail_execute_buy: "Buy Tokens",
    detail_execute_sell: "Sell Tokens",
    detail_processing: "Processing…",
    detail_price_impact: "Price Impact",
    detail_estimated_tokens: "Estimated tokens",
    detail_estimated_return: "Estimated return",
    detail_connect_wallet: "Connect wallet to trade",

    // Token Info
    info_symbol: "Symbol",
    info_supply: "Total Supply",
    info_reserve: "Reserve (SHELL)",
    info_progress: "Migration Progress",
    info_status: "Status",
    info_deployed: "Deployed",
    info_pending: "Pending",
    info_creator: "Creator",
    info_creator_rewards: "Creator Rewards",
    info_creator_rewards_desc: "0.3% of trading volume goes automatically to the creator.",
    info_about: "About",
    info_onchain: "On-Chain Identifiers",
    info_ipfs: "IPFS Metadata",
    info_token_root: "Token Root",
    info_bonding_curve: "Bonding Curve",

    // Trade Tape
    trades_title: "📊 Recent Trades",
    trades_empty: "No trades yet. Be the first!",

    // Top Holders
    holders_title: "👑 Top Holders",
    holders_empty: "No holders yet.",
    holders_bonding_curve: "🏦 Bonding Curve",
    holders_creator_badge: "Creator",

    // Chat
    chat_title: "💬 Community Chat",
    chat_empty: "No comments yet. Be the first to hype it up!",
    chat_placeholder: "Write a comment...",
    chat_signin: "Sign in to comment",
    chat_send: "Send",
    chat_success: "Comment posted successfully!",

    // Create Page
    create_title: "Launch Your Memecoin",
    create_subtitle: "Create a fair-launch token on Acki Nacki with automatic bonding curve.",
    create_name: "Token Name",
    create_symbol: "Symbol",
    create_tagline: "Tagline",
    create_description: "Description",
    create_logo: "Logo URL",
    create_supply: "Total Supply",
    create_curve: "Bonding Curve Intensity",
    create_pump_forever: "Pump Forever (no AMM migration)",
    create_fee: "Launch Fee",
    create_submit: "🚀 Launch Token",
    create_launching: "Launching…",
    create_eco_model: "Economic Model",
    create_eco_auto: "⚖️ Automatic Graduation (Classic)",
    create_eco_auto_desc: "Migrates to an internal AMM (x*y=k) when it reaches 69K SHELL, stabilizing the price for community growth.",
    create_eco_pump: "🚀 Pump Forever (Infinite Curve)",
    create_eco_pump_desc: "Never graduates. The price continues to climb exponentially on the bonding curve forever. High risk, high volatility.",
    create_pump_title: "🚀 Pump Aggressiveness",
    create_pump_subtitle: "Choose how fast the price will climb on the bonding curve. Higher aggressiveness means higher risk and faster price action.",
    create_pump_1: "🐢 Suave: Slow curve. Price climbs 2x slower, ideal for stability.",
    create_pump_2: "⚖️ Normal: The classic standard. Perfect balance between risk and reward.",
    create_pump_3: "⚡ Fast: Accelerated growth. Price climbs 2x faster, creating immediate FOMO.",
    create_pump_4: "🔥 Aggressive: High voltage. Fast movements rewarding early buyers.",
    create_pump_5: "💀 INSANE: DeGen mode! Price explodes 10x faster. Extreme volatility!",
    create_boost_title: "🔥 Launch Boost",
    create_boost_label: "Pin to Top for 24h (+500 SHELL)",
    create_boost_desc: "Your token will be highlighted at the top of the main feed to attract investors faster.",

    // Auth
    auth_title: "Connect Wallet",
    auth_subtitle: "Authenticate with your Acki Nacki wallet to access all features.",
    auth_step1: "Enter your wallet address",
    auth_step2: "Sign the challenge",
    auth_wallet_placeholder: "0:abc123...",
    auth_request_challenge: "Request Challenge",
    auth_verify: "Verify Signature",
    auth_connected: "Connected",
    auth_disconnect: "Disconnect",

    // Portfolio
    portfolio_title: "My Portfolio",
    portfolio_my_tokens: "My Created Tokens",
    portfolio_empty: "You haven't created any tokens yet.",
    portfolio_login: "Connect your wallet to view your portfolio.",

    // Error Boundary & API
    error_title: "Something went wrong",
    error_desc: "An unexpected error occurred. Try reloading the page.",
    error_reload: "Reload Page",
    error_timeout: "The request took too long and was cancelled.",
    error_http_502: "Bad Gateway. Please try again.",
    error_http_504: "Gateway Timeout. Please try again.",
    error_default: "Request failed.",
    error_no_wallet: "You don't have a TokenWallet for this token. Buy tokens first.",
    error_no_balance_gas: "Insufficient balance for gas. You need at least 0.5 SHELL.",
    error_no_price: "On-chain price not available yet. Please wait for sync.",
    error_sell_return: "Could not calculate sell return. Try again.",
    error_invalid_value: "Invalid value.",
    error_denied: "Wallet connection denied.",
    error_install_wallet: "Please install the Acki Nacki / EVER Wallet extension.",
    success_buy: "Buy successful! Tx:",

    // Common
    common_loading: "Loading…",
    common_error: "Error",
    common_success: "Success",
    common_shell: "SHELL",

    // Time
    time_just_now: "just now",
    time_m_ago: "m ago",
    time_h_ago: "h ago",
    time_d_ago: "d ago",
    chart_no_history: "No price history available yet. Start trading to generate candles!",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTUGUÊS BRASILEIRO
  // ═══════════════════════════════════════════════════════════════════════════
  pt: {
    chart_no_history: "Nenhum histórico de preço disponível ainda. Comece a negociar!",
    nav_board: "◈ Painel",
    nav_portfolio: "👜 Portfólio",
    nav_create: "🚀 Criar",
    nav_connect: "Conectar",

    hero_title_1: "o launchpad de memecoins",
    hero_title_2: "na Acki Nacki",
    hero_subtitle: "lançamento justo · curva de ligação · migração para AMM a 69K SHELL",
    hero_cta: "🚀 Lance sua moeda",

    stats_tokens_launched: "Tokens Lançados",
    stats_shell_locked: "SHELL Travados",
    stats_active_trading: "Em Negociação",
    stats_live: "Acki Nacki Ao Vivo",

    filter_new: "🕐 Novos",
    filter_trending: "🔥 Em Alta",
    filter_finishing: "🏁 Finalizando",
    filter_hall_of_fame: "🏆 Hall da Fama",
    search_placeholder: "Buscar tokens…",

    card_by: "por",
    card_supply: "Supply",
    card_progress: "Progresso",
    card_reserve: "Reserva",
    card_amm_live: "AMM ATIVO",
    card_boosted: "IMPULSIONADO",
    card_pump_forever: "∞ Pump Eterno",
    card_no_tokens: "Nenhum token lançado ainda. Seja o primeiro!",
    card_slope_label: "Curva",

    detail_back: "← Voltar",
    detail_bonding_curve: "CURVA DE LIGAÇÃO (MODELO TEÓRICO)",
    detail_buy: "Comprar",
    detail_sell: "Vender",
    detail_amount_shell: "Quantidade em SHELL",
    detail_amount_tokens: "Quantidade de tokens",
    detail_slippage: "Slippage",
    detail_execute_buy: "Comprar Tokens",
    detail_execute_sell: "Vender Tokens",
    detail_processing: "Processando…",
    detail_price_impact: "Impacto no Preço",
    detail_estimated_tokens: "Tokens estimados",
    detail_estimated_return: "Retorno estimado",
    detail_connect_wallet: "Conecte sua carteira para negociar",

    info_symbol: "Símbolo",
    info_supply: "Supply Total",
    info_reserve: "Reserva (SHELL)",
    info_progress: "Progresso da Migração",
    info_status: "Status",
    info_deployed: "Implantado",
    info_pending: "Pendente",
    info_creator: "Criador",
    info_creator_rewards: "Recompensas do Criador",
    info_creator_rewards_desc: "0,3% do volume de negociação vai automaticamente para o criador.",
    info_about: "Sobre",
    info_onchain: "Identificadores On-Chain",
    info_ipfs: "Metadados IPFS",
    info_token_root: "Token Root",
    info_bonding_curve: "Curva de Ligação",

    trades_title: "📊 Negociações Recentes",
    trades_empty: "Nenhuma negociação ainda. Seja o primeiro!",

    holders_title: "👑 Maiores Detentores",
    holders_empty: "Nenhum detentor ainda.",
    holders_bonding_curve: "🏦 Curva de Ligação",
    holders_creator_badge: "Criador",

    chat_title: "💬 Chat da Comunidade",
    chat_empty: "Nenhum comentário ainda. Seja o primeiro a animar!",
    chat_placeholder: "Escreva um comentário...",
    chat_signin: "Entre para comentar",
    chat_send: "Enviar",
    chat_success: "Comentário postado com sucesso!",

    create_title: "Lance sua Memecoin",
    create_subtitle: "Crie um token de lançamento justo na Acki Nacki com curva de ligação automática.",
    create_name: "Nome do Token",
    create_symbol: "Símbolo",
    create_tagline: "Slogan",
    create_description: "Descrição",
    create_logo: "URL do Logo",
    create_supply: "Supply Total",
    create_curve: "Intensidade da Curva",
    create_pump_forever: "Pump Eterno (sem migração AMM)",
    create_fee: "Taxa de Lançamento",
    create_submit: "🚀 Lançar Token",
    create_launching: "Lançando…",
    create_eco_model: "Modelo Econômico",
    create_eco_auto: "⚖️ Graduação Automática (Clássico)",
    create_eco_auto_desc: "Migra para um AMM interno (x*y=k) ao alcançar 69K SHELL, estabilizando o preço para crescimento da comunidade.",
    create_eco_pump: "🚀 Pump Eterno (Curva Infinita)",
    create_eco_pump_desc: "Nunca gradua. O preço continua a subir exponencialmente na curva de ligação para sempre. Alto risco, alta volatilidade.",
    create_pump_title: "🚀 Agressividade do Pump",
    create_pump_subtitle: "Escolha o quão rápido o preço subirá na curva de ligação. Maior agressividade significa maior risco e ação de preço mais rápida.",
    create_pump_1: "🐢 Suave: Curva tranquila. O preço sobe 2x mais devagar, ideal para projetos que buscam estabilidade.",
    create_pump_2: "⚖️ Normal: O padrão clássico. Equilíbrio perfeito entre risco e recompensa, igual ao pump.fun.",
    create_pump_3: "⚡ Fast: Crescimento acelerado. O preço sobe 2x mais rápido, gerando FOMO imediato.",
    create_pump_4: "🔥 Aggressive: Alta voltagem. Movimentos rápidos que recompensam os primeiros compradores.",
    create_pump_5: "💀 INSANE: Modo DeGen! O preço explode 10x mais rápido que o normal. Volatilidade extrema!",
    create_boost_title: "🔥 Impulso de Lançamento",
    create_boost_label: "Fixar no Topo por 24h (+500 SHELL)",
    create_boost_desc: "Seu token aparecerá em destaque no topo do feed principal para atrair investidores mais rápido.",

    auth_title: "Conectar Carteira",
    auth_subtitle: "Autentique com sua carteira Acki Nacki para acessar todos os recursos.",
    auth_step1: "Insira o endereço da sua carteira",
    auth_step2: "Assine o desafio",
    auth_wallet_placeholder: "0:abc123...",
    auth_request_challenge: "Solicitar Desafio",
    auth_verify: "Verificar Assinatura",
    auth_connected: "Conectado",
    auth_disconnect: "Desconectar",

    portfolio_title: "Meu Portfólio",
    portfolio_my_tokens: "Meus Tokens Criados",
    portfolio_empty: "Você ainda não criou nenhum token.",
    portfolio_login: "Conecte sua carteira para ver seu portfólio.",

    // Error Boundary & API
    error_title: "Algo deu errado",
    error_desc: "Ocorreu um erro inesperado. Tente recarregar a página.",
    error_reload: "Recarregar Página",
    error_timeout: "A requisição demorou muito e foi cancelada.",
    error_http_502: "Bad Gateway. Tente novamente.",
    error_http_504: "Gateway Timeout. Tente novamente.",
    error_default: "Falha na requisição.",
    error_no_wallet: "Você não possui uma TokenWallet para este token. Compre tokens primeiro.",
    error_no_balance_gas: "Saldo insuficiente para gas. Precisa de pelo menos 0.5 SHELL na carteira.",
    error_no_price: "Preço on-chain não disponível ainda. Aguarde a sincronização.",
    error_sell_return: "Não foi possível calcular o retorno da venda. Tente novamente.",
    error_invalid_value: "Valor inválido.",
    error_denied: "Conexão com a carteira negada.",
    error_install_wallet: "Instale a extensão Acki Nacki / EVER Wallet.",
    success_buy: "Compra realizada com sucesso! Tx:",

    common_loading: "Carregando…",
    common_error: "Erro",
    common_success: "Sucesso",
    common_shell: "SHELL",

    time_just_now: "agora",
    time_m_ago: "min atrás",
    time_h_ago: "h atrás",
    time_d_ago: "d atrás",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // РУССКИЙ (Russian)
  // ═══════════════════════════════════════════════════════════════════════════
  ru: {
    chart_no_history: "История цен пока недоступна. Начните торговать, чтобы сгенерировать свечи!",
    nav_board: "◈ Доска",
    nav_portfolio: "👜 Портфель",
    nav_create: "🚀 Создать",
    nav_connect: "Подключить",

    hero_title_1: "лаунчпад мемкоинов",
    hero_title_2: "на Acki Nacki",
    hero_subtitle: "честный запуск · кривая связи · миграция в AMM при 69K SHELL",
    hero_cta: "🚀 Запустить монету",

    stats_tokens_launched: "Токенов запущено",
    stats_shell_locked: "SHELL заблокировано",
    stats_active_trading: "Активные торги",
    stats_live: "Acki Nacki онлайн",

    filter_new: "🕐 Новые",
    filter_trending: "🔥 В тренде",
    filter_finishing: "🏁 Завершение",
    filter_hall_of_fame: "🏆 Зал славы",
    search_placeholder: "Поиск токенов…",

    card_by: "от",
    card_supply: "Объём",
    card_progress: "Прогресс",
    card_reserve: "Резерв",
    card_amm_live: "AMM АКТИВЕН",
    card_boosted: "УСКОРЕН",
    card_pump_forever: "∞ Вечный памп",
    card_no_tokens: "Токены ещё не запущены. Будьте первым!",
    card_slope_label: "Кривая",

    detail_back: "← Назад",
    detail_bonding_curve: "КРИВАЯ СВЯЗИ (ТЕОРЕТИЧЕСКАЯ МОДЕЛЬ)",
    detail_buy: "Купить",
    detail_sell: "Продать",
    detail_amount_shell: "Сумма в SHELL",
    detail_amount_tokens: "Количество токенов",
    detail_slippage: "Проскальзывание",
    detail_execute_buy: "Купить токены",
    detail_execute_sell: "Продать токены",
    detail_processing: "Обработка…",
    detail_price_impact: "Влияние на цену",
    detail_estimated_tokens: "Ожидаемые токены",
    detail_estimated_return: "Ожидаемый возврат",
    detail_connect_wallet: "Подключите кошелёк для торговли",

    info_symbol: "Символ",
    info_supply: "Общий объём",
    info_reserve: "Резерв (SHELL)",
    info_progress: "Прогресс миграции",
    info_status: "Статус",
    info_deployed: "Развёрнут",
    info_pending: "Ожидание",
    info_creator: "Создатель",
    info_creator_rewards: "Награды создателя",
    info_creator_rewards_desc: "0,3% торгового объёма автоматически идёт создателю.",
    info_about: "О проекте",
    info_onchain: "Идентификаторы On-Chain",
    info_ipfs: "Метаданные IPFS",
    info_token_root: "Token Root",
    info_bonding_curve: "Кривая связи",

    trades_title: "📊 Последние сделки",
    trades_empty: "Сделок ещё нет. Будьте первым!",

    holders_title: "👑 Крупнейшие держатели",
    holders_empty: "Держателей пока нет.",
    holders_bonding_curve: "🏦 Кривая связи",
    holders_creator_badge: "Создатель",

    chat_title: "💬 Чат сообщества",
    chat_empty: "Комментариев ещё нет. Начните общение!",
    chat_placeholder: "Напишите комментарий...",
    chat_signin: "Войдите, чтобы комментировать",
    chat_send: "Отправить",
    chat_success: "Комментарий опубликован!",

    create_title: "Запустите свой мемкоин",
    create_subtitle: "Создайте токен с честным запуском на Acki Nacki с автоматической кривой связи.",
    create_name: "Название токена",
    create_symbol: "Символ",
    create_tagline: "Слоган",
    create_description: "Описание",
    create_logo: "URL логотипа",
    create_supply: "Общий объём",
    create_curve: "Интенсивность кривой",
    create_pump_forever: "Вечный памп (без миграции AMM)",
    create_fee: "Комиссия запуска",
    create_submit: "🚀 Запустить токен",
    create_launching: "Запуск…",
    create_eco_model: "Экономическая модель",
    create_eco_auto: "⚖️ Автоматический выпуск (Классика)",
    create_eco_auto_desc: "Мигрирует в AMM (x*y=k) при достижении 69K SHELL, стабилизируя цену.",
    create_eco_pump: "🚀 Вечный памп (Бесконечная кривая)",
    create_eco_pump_desc: "Никогда не выпускается. Цена продолжает экспоненциально расти на кривой навсегда. Высокий риск.",
    create_pump_title: "🚀 Агрессивность пампа",
    create_pump_subtitle: "Выберите, как быстро будет расти цена. Более высокая агрессивность — больше риска.",
    create_pump_1: "🐢 Suave: Медленная кривая. Цена растет в 2 раза медленнее, идеально для стабильности.",
    create_pump_2: "⚖️ Normal: Классический стандарт. Идеальный баланс.",
    create_pump_3: "⚡ Fast: Ускоренный рост. Цена растет в 2 раза быстрее, создавая FOMO.",
    create_pump_4: "🔥 Aggressive: Высокое напряжение. Быстрые движения для первых покупателей.",
    create_pump_5: "💀 INSANE: Режим DeGen! Цена взрывается в 10 раз быстрее. Экстремальная волатильность!",
    create_boost_title: "🔥 Ускорение запуска",
    create_boost_label: "Закрепить в топе на 24ч (+500 SHELL)",
    create_boost_desc: "Ваш токен будет выделен в топе главной ленты.",

    auth_title: "Подключить кошелёк",
    auth_subtitle: "Аутентифицируйтесь с кошельком Acki Nacki для доступа ко всем функциям.",
    auth_step1: "Введите адрес кошелька",
    auth_step2: "Подпишите вызов",
    auth_wallet_placeholder: "0:abc123...",
    auth_request_challenge: "Запросить вызов",
    auth_verify: "Проверить подпись",
    auth_connected: "Подключён",
    auth_disconnect: "Отключить",

    portfolio_title: "Мой портфель",
    portfolio_my_tokens: "Мои созданные токены",
    portfolio_empty: "Вы ещё не создали токенов.",
    portfolio_login: "Подключите кошелёк для просмотра портфеля.",

    // Error Boundary & API
    error_title: "Что-то пошло не так",
    error_desc: "Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.",
    error_reload: "Перезагрузить",
    error_timeout: "Запрос занял слишком много времени и был отменён.",
    error_http_502: "Плохой шлюз. Пожалуйста, попробуйте еще раз.",
    error_http_504: "Тайм-аут шлюза. Пожалуйста, попробуйте еще раз.",
    error_default: "Ошибка запроса.",
    error_no_wallet: "У вас нет TokenWallet для этого токена. Сначала купите токены.",
    error_no_balance_gas: "Недостаточно средств для газа. Необходимо минимум 0.5 SHELL.",
    error_no_price: "On-chain цена еще недоступна. Пожалуйста, подождите синхронизации.",
    error_sell_return: "Не удалось рассчитать возврат от продажи. Попробуйте еще раз.",
    error_invalid_value: "Недопустимое значение.",
    error_denied: "В подключении кошелька отказано.",
    error_install_wallet: "Пожалуйста, установите расширение Acki Nacki / EVER Wallet.",
    success_buy: "Покупка прошла успешно! Tx:",

    common_loading: "Загрузка…",
    common_error: "Ошибка",
    common_success: "Успех",
    common_shell: "SHELL",

    time_just_now: "только что",
    time_m_ago: " мин назад",
    time_h_ago: " ч назад",
    time_d_ago: " д назад",
  },
};

// ─── Language detection ──────────────────────────────────────────────────────

function detectLanguage(): string {
  // 1. Check localStorage
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("ackimeme_lang");
    if (saved && translations[saved]) return saved;
  }

  // 2. Check Telegram WebApp language
  const WebApp = typeof window !== 'undefined' && window.Telegram && (window.Telegram as any).WebApp;
  if (WebApp?.initDataUnsafe?.user?.language_code) {
    const tgLang = WebApp.initDataUnsafe.user.language_code;
    if (tgLang.startsWith("pt")) return "pt";
    if (tgLang.startsWith("ru")) return "ru";
    return "en";
  }

  // 3. Check browser language
  if (typeof navigator !== "undefined") {
    const lang = navigator.language || navigator.languages?.[0] || "en";
    if (lang.startsWith("pt")) return "pt";
    if (lang.startsWith("ru")) return "ru";
  }

  return "en";
}

// ─── React Context ───────────────────────────────────────────────────────────

interface I18nContextType {
  t: (key: string) => string;
  lang: string;
  setLang: (lang: string) => void;
}

const I18nContext = createContext<I18nContextType>({ t: (k) => k, lang: "en", setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("en");

  useEffect(() => {
    setLangState(detectLanguage());
  }, []);

  const setLang = useCallback((newLang: string) => {
    if (translations[newLang]) {
      setLangState(newLang);
      if (typeof window !== "undefined") {
        localStorage.setItem("ackimeme_lang", newLang);
      }
    }
  }, []);

  const t = useCallback((key: string): string => {
    return translations[lang]?.[key] || translations.en[key] || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export const SUPPORTED_LANGS: Array<{ code: string; label: string; flag: string }> = [
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "pt", label: "PT", flag: "🇧🇷" },
  { code: "ru", label: "RU", flag: "🇷🇺" },
];
