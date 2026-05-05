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
- `MIN_CREATOR_SHELL_BALANCE`
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
MIN_CREATOR_SHELL_BALANCE=1
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
- ~~regra 80/20 enforce on-chain~~ → BondingCurve.sol já trava 100% dos reserves (liquidez permanente via AMM interno)
- ~~vault de reserva travada~~ → `tvm.rawReserve` + AMM invariant (`x*y=k`) garantem liquidez travada by design
- bonding curve ✅ (implementado)
- ~~pool automática~~ → AMM interno auto-migra ao atingir 69K SHELL

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

---

## ⚠️ Notas da Auditoria de Arquitetura (Maio 2026)

### WASM (RUNWASM) — NÃO USAR

A Acki Nacki introduziu a instrução `RUNWASM` (opcode С853) que permite executar
binários WASM **de dentro de contratos TVM-Solidity**. O TVM **NÃO está sendo
substituído** — WASM é um mecanismo de extensão.

**Decisão**: O AckiMeme **NÃO deve usar RUNWASM** até que as seguintes
vulnerabilidades de protocolo sejam esclarecidas pela equipe Acki Nacki:
- `wasi:filesystem` — acesso a arquivos do nó (não-determinístico)
- `wasi:random` — randomness não-determinístico entre nós
- `wasi:clocks` — dependência temporal
- Gas metering indefinido (vetor de DoS)
- Sem hash verification documentada para binários WASM

### ECC Token IDs (V-AM-01 — IMPLEMENTADO)

| Token | ECC ID | Decimais |
|-------|--------|----------|
| NACKL | 1      | 9 (nano) |
| SHELL | 2      | 9 (nano) |
| USDC  | 3      | 6 (micro)|

O BondingCurve.sol agora valida explicitamente que `msg.currencies[1]` (NACKL)
e `msg.currencies[3]` (USDC) são zero, aceitando SOMENTE SHELL (ID=2).

### Accumulator System (Integração Futura)

O sistema de Accumulator on-chain (`ShellAccumulatorRootUSDC`) troca SHELL por
USDC à taxa fixa de 100:1. Nosso `SHELL_BUY_SHELL_PER_USDC` deve manter
alinhamento com essa taxa.

### ZkLogin (Oportunidade)

As instruções `VERGRTH16` + `POSEIDON` permitem login via Google/Facebook/Kakao
direto na blockchain. Pode simplificar drasticamente o onboarding do AckiMeme.

### SDK

TVM SDK atualizado para `v2.24.20.an`. Verificar compatibilidade com
`@eversdk/core` usado no backend.

---

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
4. pool automática (AMM interno já implementado no BondingCurve.sol)

### Fase D - Accumulator & DeFi

1. integrar `ShellAccumulatorRootUSDC` para compra/venda de SHELL
2. integrar DEX.DO Oracle para pricing dinâmico (se necessário)
3. implementar `DappConfig` para auto-financiamento de VMSHELL
4. considerar migração do shell-buy custom para Accumulator nativo

### Fase E - proteção e growth

1. anti-sniper
2. anti-bot ML
3. rug detection
4. social layer
5. Telegram autosharing
6. gamificação
7. Bee Engine (mine-to-earn dentro do app de memes)
8. Cross-Chain Bridges (Q4 2025: integrar pools multi-chain com Ethereum/Solana via pontes nativas da Acki Nacki)

### Fase F - Auth avançado

1. avaliar ZkLogin (VERGRTH16+POSEIDON) como alternativa ao challenge/signature
2. login com Google → ephemeral key → transações assinadas
3. eliminar necessidade de extensão de wallet para onboarding

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

