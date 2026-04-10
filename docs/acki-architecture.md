# AckiMeme - arquitetura alvo na Acki Nacki

## Estado atual

O projeto hoje cobre:

- bot Telegram que abre a Web App
- frontend Next.js para montar o launch request
- backend Node/Express para verificar fee e normalizar payload

O projeto ainda nao cobre:

- login por carteira
- deploy de contratos/token root na Acki Nacki
- pool/bonding curve
- camada de risco, antifraude e admin
- social layer, ranking, gamificacao

## Premissas confirmadas na documentacao

### Acki Nacki / SDK

- A rede expõe GraphQL para consultar contas, mensagens, transacoes e para enviar mensagens preparadas.
- O SDK oficial suporta JS/TS com `@tvmsdk/core`, `@tvmsdk/lib-node` e `@tvmsdk/lib-web`.
- Mensagens externas podem ser assinadas fora do SDK e anexadas depois.
- Conta e contrato sao a mesma entidade na Acki Nacki.
- O conceito de `Dapp ID` agrupa contratos do mesmo app e permite subsidiar operacoes.

### Taxas / fee model

- Taxas de execucao da rede sao pagas em `VMSHELL`, nao em USDC.
- `SHELL` pode ser convertido 1:1 para `VMSHELL`.
- O `DappConfig` permite auto-replenishment para contratos do mesmo Dapp ID.
- Transacoes entre contratos do mesmo thread podem ser gratuitas; entre threads podem precisar de subsidio com `DappConfig`.

### Bee Engine

- Bee Engine pode embutir mineracao de NACKL no cliente.
- A documentacao posiciona Bee Engine como base para reputacao, recompensas e sistemas de contribuicao verificavel.

## Implicacoes para os requisitos

### 1. Login por carteira

Isso deve substituir o login por formulario/manual atual.

Implementacao recomendada:

- frontend faz `connect wallet`
- frontend pede assinatura de nonce curto com expiracao
- backend valida a assinatura, amarra a sessao ao endereco da carteira e ao usuario do Telegram WebApp
- backend emite sessao curta com `anti-replay`

Observacao:

- a documentacao da Acki Nacki mostra assinatura de mensagens externas e tambem mostra um fluxo de dashboard que confirma posse da wallet por assinatura de mensagem
- para UX futura, zk-auth/OpenID pode ser opcional, mas nao deve bloquear a primeira versao

### 2. Anti-relay / anti-replay

Tem que existir em dois niveis:

- autenticacao: nonce unico, expiracao curta, uso unico, binding a `telegram_user_id`, wallet e device fingerprint leve
- transacao sensivel: idempotency key por acao, challenge separado por operacao, confirmacao server-side de estado da sessao

Sem isso, assinatura reaproveitada ou reenvio de request vira vetor trivial.

### 3. Anti-bot ML

Isso nao pertence ao contrato. Deve ficar fora da cadeia.

Arquitetura:

- ingestao de eventos no backend
- feature store simples
- score de risco por carteira, IP, device, cadence, cluster social, padrao de funding
- score interfere em limites, cooldown, revisao manual e peso social

Primeira versao pragmatica:

- heuristicas e regras
- depois um classificador supervisionado

### 4. Sniper detection / anti-sniper / pool automatica apos bonding

Isso exige contratos e politica de risco clara.

Separacao correta:

- `bonding curve` e regras de distribuicao inicial ficam on-chain
- `sniper detection` fica off-chain, consumindo eventos da pool e do token
- `anti-sniper` pode ter parte on-chain, por exemplo:
  - cooldown inicial
  - max buy por janela
  - penalidade/fee extra inicial
  - blacklist temporaria por regra objetiva

Ponto importante:

- eu nao encontrei nessa rodada uma documentacao pronta de bonding curve launchpad na Acki Nacki
- portanto, a leitura tecnica atual e que essa parte vai exigir contratos proprios, nao apenas integracao simples

### 5. Social layer / ranking social / Telegram autosharing

Isso e majoritariamente off-chain, com espelho resumido on-chain so se houver necessidade.

Arquitetura:

- perfil do criador vinculado a carteira e Telegram
- score social agregado por:
  - holders
  - retenção
  - atividade de comunidade
  - engajamento em compartilhamento
  - flags de risco
- autosharing do Telegram via bot e webhooks/eventos internos do app

### 6. Gamificacao

Tem dois niveis possiveis:

- gamificacao off-chain: missoes, streaks, ranking, boosts
- gamificacao verificavel: integrar Bee Engine para recompensas/reputacao baseadas em trabalho do cliente

Recomendacao:

- fase 1: gamificacao off-chain
- fase 2: Bee Engine para reputacao forte e reward loops

### 7. Rug detection automatica

Isso tambem e off-chain primeiro.

Motor de risco deve observar:

- concentracao de supply
- alteracoes suspeitas no owner/admin do token
- comportamento de liquidez/pool
- vendas do criador e wallets relacionadas
- padrao de wash activity
- links sociais quebrados, apagados ou trocados

Output:

- score de risco
- flags
- bloqueios automáticos
- fila de revisao no admin

### 8. Dashboard admin

Necessario. Sem isso, as features de risco ficam cegas.

Modulos minimos:

- launches
- criadores
- wallets
- transacoes de fee
- scores ML/risk
- incidentes de sniper/rug
- social ranking
- moderacao manual
- parametros de bonding/pool

### 9. Bonding curve

Tem que ser tratada como modulo central de protocolo, nao como regra de frontend.

Componentes:

- contrato root da memecoin
- contrato de treasury/reserva travada
- contrato da bonding curve ou pool primaria
- indexador/backend para analytics e deteccao

Como a documentacao consultada nao mostrou contrato padrao pronto para isso, devemos assumir implementacao propria.

### 10. Distribuicao inicial

Regra requerida:

- 80% criador
- 20% reserva trancada

Isso deve ser enforce on-chain.

Implementacao recomendada:

- mint inicial atomico no deploy
- 80% enviado para a wallet/vesting do criador
- 20% enviado para um contrato `LockedReserveVault`
- regras de unlock explicitadas no contrato

Nao pode ficar apenas salvo em banco.

### 11. Taxa 100% para o app

Aqui existe uma distincao obrigatoria:

- taxa do app: pode ir 100% para treasury do produto
- taxa da rede: continua sendo `VMSHELL`

Se o usuario pagar a criacao com `SHELL`:

- a fee de produto pode ser recebida no treasury do app em SHELL
- parte operacional necessaria pode ser convertida/gerida para VMSHELL via fluxo do Dapp

Se o usuario pagar com `USDC`:

- o backend precisa validar o pagamento em USDC
- depois precisa assegurar saldo operacional de `SHELL/VMSHELL` para deploy e manutencao dos contratos

Conclusao:

- `SHELL ou USDC` como meio de cobranca do app e viavel
- mas a operacao da dapp continua dependente de `VMSHELL` dentro da rede

## Arquitetura alvo

### Frontend / Telegram Mini App

- conect wallet
- assinatura de nonce
- criacao de launch
- pagamento de fee (SHELL ou USDC)
- fluxo de configuracao da bonding curve
- painel do criador
- social tasks / autosharing / gamificacao

### Bot Telegram

- abre Mini App
- compartilha launches
- autosharing de milestones
- notificacoes de score, risco, pool aberta, unlock e ranking

### Backend API

- auth por wallet + Telegram binding
- sessao, anti-replay, rate limit
- risk engine
- scorer de bot/sniper/rug
- indexador GraphQL Acki Nacki
- orquestracao de deploy
- fila de jobs
- painel admin

### Blockchain / contratos

- LaunchFactory
- MemeTokenRoot
- CreatorAllocationVault
- LockedReserveVault
- BondingCurvePool
- FeeTreasury
- talvez DappConfig para subsidio operacional

### Dados off-chain

- users
- wallet_sessions
- launch_requests
- tokens
- pools
- trades
- social_profiles
- social_events
- risk_scores
- admin_cases

## Ordem recomendada de execucao

### Fase 1 - fundacao tecnica

- login por carteira com nonce, expiracao e anti-replay
- modelo de dados novo
- painel admin inicial
- fee de criacao com `SHELL` e `USDC` no backend
- indexador GraphQL Acki Nacki

### Fase 2 - launch protocol

- contratos de token + vault de reserva
- regra 80/20 on-chain
- factory de deploy
- sincronizacao backend <-> chain

### Fase 3 - mercado primario

- bonding curve
- abertura automatica de pool
- deteccao de sniper
- anti-sniper inicial

### Fase 4 - intelligence layer

- risk engine
- rug detection
- scoring de bot
- revisao/admin assistida

### Fase 5 - growth layer

- ranking social
- Telegram autosharing
- gamificacao
- Bee Engine, se quisermos reputacao verificavel ou reward loop forte

## Decisoes que eu considero obrigatorias antes de codar os contratos

- qual padrao de token fungivel vamos usar na Acki Nacki
- como sera o fluxo exato de pagamento em USDC
- qual evento abre a pool automaticamente
- qual formula da bonding curve
- como funciona o lock da reserva de 20%
- quais acoes do criador disparam bloqueio de rug

## Proxima rodada recomendada

Implementar primeiro:

1. wallet auth com anti-replay
2. schema/backend para fee em `SHELL | USDC`
3. base do admin dashboard
4. modelo de dominio para `launch`, `token`, `treasury`, `risk`

Sem isso, o restante vira UI sem sustentacao protocolar.

## Fontes consultadas

- https://docs.ackinacki.com/
- https://docs.ackinacki.com/tokenomics
- https://docs.ackinacki.com/tokenomics/fee-system
- https://docs.ackinacki.com/for-developers/getting-started-with-acki-nacki
- https://docs.ackinacki.com/for-users/wallets/zk-login-authentication-flow
- https://dev.ackinacki.com/
- https://dev.ackinacki.com/graphql/graphql-api
- https://dev.ackinacki.com/graphql/schema
- https://dev.ackinacki.com/examples/graphql-api-examples/accounts
- https://dev.ackinacki.com/examples/graphql-api-examples/transactions
- https://dev.ackinacki.com/examples/graphql-api-examples/send-message
- https://dev.ackinacki.com/abi/abi
- https://dev.ackinacki.com/reference/types-and-methods/mod_abi
- https://dev.ackinacki.com/js-ts-guides/work_with_contracts/external_signing
- https://dev.ackinacki.com/bee-engine/bee-engine-overview
- https://dev.ackinacki.com/dapp-id-full-guide-creation-fees-centralized-replenishment
- https://www.dex.do/

Observacao:

- o link curto `https://bit.ly/3LErJng` nao abriu nesta sessao, entao nao foi considerado.
