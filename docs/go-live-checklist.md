# AckiMeme - checklist de go-live

## O que precisa existir para publicar

### 1. Frontend

- projeto Vercel apontando para `frontend/`
- domínio `ackimeme.fun` conectado ao projeto
- opcionalmente `www.ackimeme.fun` redirecionando para `ackimeme.fun`

### 2. Backend

- serviço separado para `backend/`
- recomendado: Railway, Render, Fly.io ou VPS com Docker
- domínio/API recomendado: `api.ackimeme.fun`
- healthcheck pronto:
  - `GET /healthz`
  - `GET /readyz`

### 3. Banco

- PostgreSQL

Status atual:

- storage principal já migrado para PostgreSQL
- migração inicial em `backend/src/migrations/001_init.sql`

Tabelas atuais:

- wallet_sessions
- auth_challenges
- launches
- treasury_payments
- risk_profiles
- audit_events
- reward_tasks

### 4. Telegram bot

- bot criado no BotFather
- `WEB_APP_URL=https://ackimeme.fun`
- menu/button do bot apontando para o domínio final
- se usar validação forte de Mini App, `TELEGRAM_BOT_TOKEN` configurado no backend

### 5. Acki Nacki

- endpoint GraphQL real em `GRAPHQL_URL`
- fee wallet real em `FEE_WALLET`
- definição do wallet/provider real que será suportado no login
- definição do fluxo de deploy on-chain

## Variáveis de ambiente que eu vou precisar

### Backend

- `PORT`
- `APP_NAME`
- `APP_NETWORK`
- `DATABASE_URL`
- `DATABASE_SSL`
- `GRAPHQL_URL`
- `FEE_WALLET`
- `CREATION_FEE_SHELL`
- `CREATION_FEE_USDC`
- `ALLOWED_ORIGINS`
- `AUTH_CHALLENGE_TTL_SECONDS`
- `SESSION_TTL_HOURS`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_AUTH_MAX_AGE_SECONDS`
- `ADMIN_TOKEN`

Produção sugerida:

```env
PORT=3000
APP_NAME=AckiMeme
APP_NETWORK=Acki Nacki
DATABASE_URL=postgresql://postgres:password@localhost:5432/ackimeme
DATABASE_SSL=false
GRAPHQL_URL=<endpoint-real-acki>
FEE_WALLET=<wallet-real-do-app>
CREATION_FEE_SHELL=3
CREATION_FEE_USDC=10
ALLOWED_ORIGINS=https://ackimeme.fun,https://www.ackimeme.fun
AUTH_CHALLENGE_TTL_SECONDS=300
SESSION_TTL_HOURS=24
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_AUTH_MAX_AGE_SECONDS=86400
ADMIN_TOKEN=<token-longo-e-aleatorio>
```

### Frontend

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_NETWORK_LABEL`
- `NEXT_PUBLIC_SUPPORT_URL`
- `NEXT_PUBLIC_SITE_URL`

Produção sugerida:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.ackimeme.fun
NEXT_PUBLIC_APP_NAME=AckiMeme
NEXT_PUBLIC_NETWORK_LABEL=Acki Nacki
NEXT_PUBLIC_SUPPORT_URL=https://t.me/<seu_bot_ou_suporte>
NEXT_PUBLIC_SITE_URL=https://ackimeme.fun
```

### Bot

- `BOT_TOKEN`
- `WEB_APP_URL`
- `BOT_WELCOME_TEXT`

Produção sugerida:

```env
BOT_TOKEN=<bot-token>
WEB_APP_URL=https://ackimeme.fun
BOT_WELCOME_TEXT=Launch memecoins on Acki Nacki from Telegram.
```

## O que ainda bloqueia o go-live real do dapp

### Bloqueadores de protocolo

- integração real com provider da wallet Acki Nacki no frontend
- prova forte `wallet contract -> public key`
- factory/deploy do token on-chain
- regra 80/20 enforce on-chain
- vault de reserva travada
- bonding curve
- pool automática

### Bloqueadores de operação

- autenticação do admin melhor que `ADMIN_TOKEN`
- observabilidade básica:
  - logs estruturados
  - error tracking
  - uptime monitor
- política de backup

### Bloqueadores de risco

- anti-sniper
- anti-bot ML
- rug detection real
- score/risk engine forte

## Ordem prática para colocar no ar

### Fase A - publicação técnica

1. subir frontend na Vercel com `ackimeme.fun`
2. subir backend em `api.ackimeme.fun`
3. configurar bot para abrir o domínio final
4. validar CORS e auth do Telegram

### Fase B - MVP funcional real

1. integrar wallet/provider Acki Nacki
2. ligar fee real na Acki Nacki
3. revisar schema para projetos admin-curated e reward tasks
4. persistir tarefas e completions de recompensa

### Fase C - protocolo

1. token factory
2. vault 80/20
3. bonding curve
4. pool automática

### Fase D - proteção e growth

1. anti-sniper
2. anti-bot ML
3. rug detection
4. social layer
5. Telegram autosharing
6. gamificação

## Sugestão de arquitetura pública

- `ackimeme.fun` -> frontend Vercel
- `api.ackimeme.fun` -> backend Node
- `db.ackimeme.fun` nao exposto publicamente
- bot Telegram abrindo `https://ackimeme.fun`

## Observação importante sobre o design

Você citou o `pump.fun` como referência prática e visual. O caminho correto é usar essa referência para:

- launch feed público
- create flow simples
- navegação curta
- foco em velocidade

Mas sem copiar o protocolo ou a UI cegamente. O que ainda falta no AckiMeme é a camada protocolar própria da Acki Nacki; o design sozinho não fecha o produto.
