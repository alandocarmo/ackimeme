# AckiMeme

Mini App para Telegram focado em lançamento de memecoins na blockchain Acki Nacki.
Os usuários acessam via bot do Telegram que abre o DApp no navegador integrado.
Toda a economia usa SHELL (token nativo da Acki Nacki) para fees e trading.

## Estrutura

- `frontend`: interface Next.js (TypeScript) aberta dentro do Telegram.
- `backend`: API Express (TypeScript) para config pública, verificação de fee e preparo do launch request.
- `bot`: bot Telegraf (TypeScript) que abre a Web App.
- `shared-types`: pacote interno TypeScript com tipagens e interfaces unificadas entre todos os módulos.

## Ambiente

- `backend/.env.example`
- `frontend/.env.example`
- `bot/.env.example`

Copie cada arquivo para `.env` no respectivo módulo e preencha os valores.

## Rodando localmente

Suba primeiro um PostgreSQL local. O `docker-compose.yml` já expõe uma instância em `postgresql://postgres:password@localhost:5432/ackimeme`.

```bash
docker compose up -d db
cd backend && npm install && npm run db:migrate && npm run db:seed:demo && npm start
cd frontend && npm install && npm run dev
cd bot && npm install && npm start
```

Se você já tiver Postgres rodando fora do compose:

```bash
cd backend && npm install && npm start
cd frontend && npm install && npm run dev
cd bot && npm install && npm start
```

## Teste local da auth

Para testar a auth por assinatura sem integrar ainda a wallet real da Acki Nacki:

```bash
cd backend && npm run dev:wallet:init
```

Isso cria `backend/data/dev-wallet.json` com uma carteira Ed25519 local de teste.

Fluxo:

1. Inicie backend e frontend.
2. Use `dev-wallet-local` como `wallet address` na tela inicial.
3. Clique em `Gerar challenge`.
4. Copie a mensagem do challenge para um arquivo, por exemplo `challenge.txt`.
5. Assine localmente:

```bash
cd backend && node scripts/dev-wallet.js sign challenge.txt
```

6. Copie `publicKeyHex` e `signatureHex` do output para a tela.
7. Clique em `Entrar com wallet`.

Observação:

- isso testa o fluxo de challenge/sessão/anti-replay do app
- isso ainda não substitui a integração real com o provider de wallet da Acki Nacki

## Fluxo atual

1. O bot abre a Web App configurada em `WEB_APP_URL`.
2. O frontend busca `/config`, gera challenge de auth por wallet e abre sessão curta com anti-replay.
3. O usuário paga fee de criação em SHELL (nativo da Acki Nacki) e o backend valida a transferência on-chain.
4. O backend exige saldo mínimo em SHELL na carteira do criador para cobrir gas fees.
5. O feed público geral recebe os `launch-request` criados no fluxo padrão do app.
6. A página `/admin/security` opera o painel de segurança com `ADMIN_TOKEN`.
7. A página `/buy-shell` permite validar compras in-app USDC → SHELL (TIP-3) quando `ENABLE_SHELL_BUY=true`.

Configuração mínima no `backend/.env` para habilitar compra in-app:

```env
ENABLE_SHELL_BUY=true
SHELL_BUY_USDC_RECIPIENT=0:SEU_ENDERECO_RECEBEDOR_USDC
SHELL_BUY_MIN_USDC=1
SHELL_BUY_SHELL_PER_USDC=100
SHELL_BUY_USDC_DECIMALS=6
```

## Seed demo

Para popular o banco com dados de teste do board público:

```bash
cd backend && npm run db:seed:demo
```

O seed atual cria:

- 2 coins demo no feed público geral

O comando é seguro para rerodar: ele substitui apenas os registros demo criados por esse script.

## Admin auth

O modo recomendado do protótipo agora é:

- autenticar no app com wallet
- colocar essa wallet em `ADMIN_WALLETS` no backend
- abrir `/admin/security` para monitoramento

Fallback operacional:

- `ADMIN_TOKEN`

Exemplo em `backend/.env`:

```env
ADMIN_WALLETS=dev-wallet-local,acki_admin_wallet_real
ADMIN_TOKEN=change_me
```

## Como subir PostgreSQL local

### Opção 1. Docker Desktop

Se você ainda não tem Postgres instalado, o caminho mais simples é:

1. Instalar o Docker Desktop no Windows.
2. Reiniciar a máquina se o instalador pedir.
3. Abrir o Docker Desktop e esperar o engine ficar ativo.
4. No projeto, rodar:

```bash
cd C:\Users\alanp\ackimeme
docker compose up -d db
```

5. Verificar se o banco respondeu:

```bash
docker compose ps
```

6. Rodar migração e seed:

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed:demo
```

### Opção 2. PostgreSQL nativo

Se preferir instalar o Postgres direto:

1. Instale PostgreSQL 16 ou superior.
2. Crie um banco chamado `ackimeme`.
3. Ajuste `backend/.env` com sua `DATABASE_URL`.
4. Rode:

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed:demo
```

### O que eu preciso de você para eu testar em banco real

Quando o Postgres estiver rodando na sua máquina, preciso só que estas condições estejam verdadeiras:

- `docker` ou `psql` disponível no terminal deste workspace
- `backend/.env` apontando para uma `DATABASE_URL` válida
- o banco aceitando conexão local

Depois disso eu consigo rodar daqui:

```bash
cd backend
npm run db:migrate
npm run db:seed:demo
node src/main.js
```

E validar endpoints como:

- `GET /readyz`
- `GET /launches/public`

## Storage atual

- PostgreSQL como storage principal
- migração SQL em [backend/src/migrations/001_init.sql](C:/Users/alanp/ackimeme/backend/src/migrations/001_init.sql)
- script manual de migração: `cd backend && npm run db:migrate`

O schema já inclui a tabela `reward_tasks` para a próxima rodada do protótipo.

## Falta conectar

- vínculo forte entre wallet contract e public key do tipo exato de wallet Acki Nacki
- validar oficialmente o deep link mobile `ackinacki://login`; enquanto não houver especificação pública, trate o QR mobile como experimental e mantenha fallback por provider/assinatura manual
- factory/deploy on-chain do token (configurar `ENABLE_ONCHAIN_DEPLOY=true`, `DEPLOYER_SECRET_KEY` 64 ou 128 hex e `DEPLOYER_WALLET_ADDRESS` financiada para pré-financiar o endereço futuro)
- monitoramento avançado (Sentry ou equivalente)
