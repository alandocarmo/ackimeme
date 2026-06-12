#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# deploy-factories.sh — Deploy on-chain da LaunchFactory + AckiSwapFactory
#
# Roda DENTRO da imagem Docker dos contratos (tem tvm-cli), com o repo em /repo:
#
#   docker run --rm \
#     -v "C:\Users\alanp\ackimeme:/repo" \
#     -v "C:\caminho\para\secrets:/secrets" \
#     -e DEPLOYER_KEYS_FILE=/secrets/deployer.keys.json \
#     -e DEPLOYER_WALLET_ADDRESS=0:SUA_MULTISIG_64_HEX \
#     -e FEE_WALLET=0:SUA_FEE_WALLET_64_HEX \
#     --entrypoint sh ackimeme-contracts /repo/scripts/deploy-factories.sh
#
# Variáveis:
#   DEPLOYER_KEYS_FILE       (obrig.) JSON {"public":"hex","secret":"hex"} — assina
#                            os deploys (pubkey embutida → auth das factories) e
#                            deve ser custodian da multisig financiadora.
#   DEPLOYER_WALLET_ADDRESS  (obrig.) multisig UpdateCustodianMultisigWallet que
#                            financia os endereços (sendTransaction flags:16).
#   FEE_WALLET               (obrig.) feeRecipient das duas factories.
#   OWNER_ADDRESS            (opc.)  owner da LaunchFactory/AckiSwapFactory.
#                            Default: DEPLOYER_WALLET_ADDRESS. PRECISA ser uma
#                            conta capaz de enviar msg interna (setAmmFactory).
#   NETWORK_URL              (opc.)  default shellnet.ackinacki.org
#                            (mainnet: mainnet.ackinacki.org)
#   PREFUND_SHELL_NANO       (opc.)  SHELL enviado a cada endereço antes do
#                            deploy (flags:16 → vira VMSHELL). Default 30 SHELL.
#   FACTORY_ECC_TOPUP_NANO   (opc.)  SHELL ECC enviado à LaunchFactory após o
#                            deploy (cada launch consome ~2 SHELL ECC no
#                            initAftWallet). Default 50 SHELL.
#   DRY_RUN=1                (opc.)  só prediz endereços e imprime o plano.
#
# Pós-deploy (manual):
#   1. Render: LAUNCH_FACTORY_ADDRESS=<endereço impresso> + redeploy do backend.
#   2. Manter saldo da LaunchFactory: ≥3 VMSHELL nativo + 2 SHELL ECC por launch.
#   3. Manter saldo da AckiSwapFactory: ~2.2 VMSHELL nativo por migração de pool.
# ─────────────────────────────────────────────────────────────────────────────
set -eu

REPO=${REPO:-/repo}
ABI_DIR="$REPO/contracts/build"
NETWORK_URL=${NETWORK_URL:-shellnet.ackinacki.org}
PREFUND_SHELL_NANO=${PREFUND_SHELL_NANO:-30000000000}
FACTORY_ECC_TOPUP_NANO=${FACTORY_ECC_TOPUP_NANO:-50000000000}
PREFUND_MSG_VALUE_NANO=${PREFUND_MSG_VALUE_NANO:-500000000}
DRY_RUN=${DRY_RUN:-0}
EMPTY_CELL="te6ccgEBAQEAAgAAAA=="
MULTISIG_ABI="$REPO/backend/src/abi/UpdateCustodianMultisigWallet.abi.json"

: "${DEPLOYER_KEYS_FILE:?Defina DEPLOYER_KEYS_FILE (json public/secret hex)}"
: "${DEPLOYER_WALLET_ADDRESS:?Defina DEPLOYER_WALLET_ADDRESS (multisig financiadora)}"
: "${FEE_WALLET:?Defina FEE_WALLET (feeRecipient)}"
OWNER_ADDRESS=${OWNER_ADDRESS:-$DEPLOYER_WALLET_ADDRESS}

[ -f "$DEPLOYER_KEYS_FILE" ] || { echo "ERRO: keys file não encontrado: $DEPLOYER_KEYS_FILE"; exit 1; }
[ -f "$ABI_DIR/LaunchFactory.tvc" ] || { echo "ERRO: artefatos não encontrados em $ABI_DIR"; exit 1; }

CLI="tvm-cli --url $NETWORK_URL"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

extract_code() { # extract_code <tvc> → base64 do code cell
  tvm-cli decode stateinit --tvc "$1" | sed -n 's/.*"code": *"\([^"]*\)".*/\1/p' | head -1
}

genaddr_saved() { # genaddr_saved <tvc-tmp> <abi> [data-json] → raw address (e grava data+pubkey no tvc)
  if [ -n "${3:-}" ]; then
    tvm-cli genaddr "$1" --abi "$2" --setkey "$DEPLOYER_KEYS_FILE" --data "$3" --save
  else
    tvm-cli genaddr "$1" --abi "$2" --setkey "$DEPLOYER_KEYS_FILE" --save
  fi | sed -n 's/^Raw address: *//p'
}

acc_type() { # acc_type <addr> → Active | Uninit | NonExist
  $CLI account "$1" 2>/dev/null | sed -n 's/^acc_type: *//p' | head -1
}

wait_funded() { # wait_funded <addr>
  i=0
  while [ $i -lt 40 ]; do
    bal=$($CLI account "$1" 2>/dev/null | sed -n 's/^balance: *\([0-9]*\).*/\1/p' | head -1)
    [ -n "$bal" ] && [ "$bal" != "0" ] && return 0
    i=$((i+1)); sleep 3
  done
  echo "ERRO: timeout aguardando funding de $1"; exit 1
}

multisig_send() { # multisig_send <dest> <value> <cc-shell-nano|0> <bounce> <flags> <payload>
  if [ "$3" = "0" ]; then CC="{}"; else CC="{\"2\":\"$3\"}"; fi
  $CLI call "$DEPLOYER_WALLET_ADDRESS" sendTransaction \
    "{\"dest\":\"$1\",\"value\":\"$2\",\"cc\":$CC,\"bounce\":$4,\"flags\":$5,\"payload\":\"$6\"}" \
    --abi "$MULTISIG_ABI" --sign "$DEPLOYER_KEYS_FILE" > /dev/null
}

echo "═══ AckiMeme — deploy das factories ($NETWORK_URL) ═══"
echo ""
echo "── 1/7 Extraindo code cells dos .tvc"
PAIR_CODE=$(extract_code "$ABI_DIR/AckiSwapPair.tvc")
TOKEN_ROOT_CODE=$(extract_code "$ABI_DIR/TokenRoot.tvc")
BONDING_CURVE_CODE=$(extract_code "$ABI_DIR/BondingCurve.tvc")
TOKEN_WALLET_CODE=$(extract_code "$ABI_DIR/TokenWallet.tvc")
for v in PAIR_CODE TOKEN_ROOT_CODE BONDING_CURVE_CODE TOKEN_WALLET_CODE; do
  eval "val=\$$v"
  [ -n "$val" ] || { echo "ERRO: falha ao extrair $v"; exit 1; }
done
echo "   ok (pair code: $(echo "$PAIR_CODE" | cut -c1-24)…)"

echo "── 2/7 Predizendo endereços (pubkey do deployer embutida)"
cp "$ABI_DIR/AckiSwapFactory.tvc" "$WORK/asf.tvc"
cp "$ABI_DIR/LaunchFactory.tvc" "$WORK/lf.tvc"
ASF_ADDR=$(genaddr_saved "$WORK/asf.tvc" "$ABI_DIR/AckiSwapFactory.abi.json" \
  "{\"_owner\":\"$OWNER_ADDRESS\",\"_pairCode\":\"$PAIR_CODE\"}")
LF_ADDR=$(genaddr_saved "$WORK/lf.tvc" "$ABI_DIR/LaunchFactory.abi.json")
[ -n "$ASF_ADDR" ] && [ -n "$LF_ADDR" ] || { echo "ERRO: genaddr falhou"; exit 1; }
echo "   AckiSwapFactory: $ASF_ADDR"
echo "   LaunchFactory:   $LF_ADDR"

if [ "$DRY_RUN" = "1" ]; then
  echo ""
  echo "DRY_RUN=1 — nada foi enviado. Plano:"
  echo "  prefund  $PREFUND_SHELL_NANO nanoSHELL (flags:16) → cada endereço acima"
  echo "  deploy   AckiSwapFactory(_feeRecipient=$FEE_WALLET)"
  echo "  deploy   LaunchFactory(owner=$OWNER_ADDRESS, feeRecipient=$FEE_WALLET, codes…)"
  echo "  call     AckiSwapFactory.setLaunchFactory($LF_ADDR)  [externo, assinado]"
  echo "  multisig LaunchFactory.setAmmFactory($ASF_ADDR)      [interno via owner]"
  echo "  topup    $FACTORY_ECC_TOPUP_NANO nanoSHELL ECC → LaunchFactory"
  exit 0
fi

echo "── 3/7 Pré-financiando endereços (flags:16, SHELL→VMSHELL)"
for ADDR in "$ASF_ADDR" "$LF_ADDR"; do
  if [ "$(acc_type "$ADDR")" = "Active" ]; then
    echo "   $ADDR já está Active — pulando prefund"
    continue
  fi
  multisig_send "$ADDR" "$PREFUND_MSG_VALUE_NANO" "$PREFUND_SHELL_NANO" false 16 "$EMPTY_CELL"
  wait_funded "$ADDR"
  echo "   $ADDR financiado"
done

echo "── 4/7 Deploy AckiSwapFactory"
if [ "$(acc_type "$ASF_ADDR")" = "Active" ]; then
  echo "   já deployada — pulando"
else
  $CLI deploy "$WORK/asf.tvc" "{\"_feeRecipient\":\"$FEE_WALLET\"}" \
    --abi "$ABI_DIR/AckiSwapFactory.abi.json" --sign "$DEPLOYER_KEYS_FILE"
fi

echo "── 5/7 Deploy LaunchFactory"
if [ "$(acc_type "$LF_ADDR")" = "Active" ]; then
  echo "   já deployada — pulando"
else
  $CLI deploy "$WORK/lf.tvc" "{\"_owner\":\"$OWNER_ADDRESS\",\"_feeRecipient\":\"$FEE_WALLET\",\"_tokenRootCode\":\"$TOKEN_ROOT_CODE\",\"_bondingCurveCode\":\"$BONDING_CURVE_CODE\",\"_tokenWalletCode\":\"$TOKEN_WALLET_CODE\"}" \
    --abi "$ABI_DIR/LaunchFactory.abi.json" --sign "$DEPLOYER_KEYS_FILE"
fi

echo "── 6/7 Wiring"
echo "   AckiSwapFactory.setLaunchFactory → $LF_ADDR (msg externa assinada)"
$CLI call "$ASF_ADDR" setLaunchFactory "{\"_launchFactory\":\"$LF_ADDR\"}" \
  --abi "$ABI_DIR/AckiSwapFactory.abi.json" --sign "$DEPLOYER_KEYS_FILE" > /dev/null

echo "   LaunchFactory.setAmmFactory → $ASF_ADDR (msg interna via owner/multisig)"
SET_AMM_BODY=$(tvm-cli body setAmmFactory "{\"_ammFactory\":\"$ASF_ADDR\"}" \
  --abi "$ABI_DIR/LaunchFactory.abi.json" | sed -n 's/^Message body: *//p')
[ -n "$SET_AMM_BODY" ] || { echo "ERRO: encode do body setAmmFactory falhou"; exit 1; }
multisig_send "$LF_ADDR" "300000000" "0" false 1 "$SET_AMM_BODY"

echo "   Top-up de SHELL ECC na LaunchFactory ($FACTORY_ECC_TOPUP_NANO nano)"
multisig_send "$LF_ADDR" "$PREFUND_MSG_VALUE_NANO" "$FACTORY_ECC_TOPUP_NANO" false 1 "$EMPTY_CELL"

echo "── 7/7 Verificação"
sleep 5
echo "   LaunchFactory.ammFactory:"
$CLI run "$LF_ADDR" ammFactory "{}" --abi "$ABI_DIR/LaunchFactory.abi.json" | grep -A2 Result || true
echo "   AckiSwapFactory.launchFactory:"
$CLI run "$ASF_ADDR" launchFactory "{}" --abi "$ABI_DIR/AckiSwapFactory.abi.json" | grep -A2 Result || true

echo ""
echo "═══ Concluído ═══"
echo "LAUNCH_FACTORY_ADDRESS=$LF_ADDR"
echo "AMM_FACTORY_ADDRESS=$ASF_ADDR"
echo ""
echo "Próximos passos:"
echo "  1. No Render: setar LAUNCH_FACTORY_ADDRESS=$LF_ADDR e ENABLE_ONCHAIN_DEPLOY=true, redeploy."
echo "  2. Confirmar que ammFactory/launchFactory acima NÃO são 0:0000…"
echo "  3. Testar um launch + migração completa na shellnet antes da mainnet."
