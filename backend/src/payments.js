/**
 * payments.js
 *
 * Verificação de pagamento de fee de criação de coin.
 *
 * Fluxo (SHELL-only):
 *   1. Usuário envia SHELL para FEE_WALLET na Acki Nacki
 *   2. Frontend manda { walletAddress, txHash, tokenSymbol: "SHELL" } para POST /verify-payment
 *   3. Este módulo consulta a blockchain e valida a transação nativa
 *
 * Documentação GraphQL: https://dev.ackinacki.com/graphql/graphql-api
 * Endpoint testnet: https://shellnet.ackinacki.org/graphql
 */

const { getTransaction } = require("./services/graphql.service");
const { getCreationFeeRequirement, normalizeTokenSymbol } = require("./treasury");

/**
 * Normaliza endereço TVM Acki Nacki: lowercase, trim, sem espaços.
 * Formato padrão: "0:hex64"
 */
function normalizeTvmAddress(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Verifica se uma transação SHELL cumpre os requisitos de fee.
 *
 * @param {{ walletAddress: string, txHash: string, tokenSymbol: string, isBoosted?: boolean }} params
 * @returns {Promise<object>} Dados do pagamento verificado
 */
async function verifyPayment({ walletAddress, txHash, tokenSymbol, isBoosted = false }) {
  const requirement = getCreationFeeRequirement(tokenSymbol || "SHELL");

  let tx;
  try {
    tx = await getTransaction(txHash);
  } catch (error) {
    throw new Error(`Erro ao consultar a blockchain: ${error.message}`);
  }

  if (!tx) {
    throw new Error(
      "Transação não encontrada na blockchain. Aguarde alguns segundos após o envio e tente novamente.",
    );
  }

  if (tx.status !== "SUCCESS") {
    throw new Error(
      `Transação ainda não finalizada (status: ${tx.status}). Aguarde a confirmação na rede Acki Nacki.`,
    );
  }

  // Valida o remetente (quem enviou a fee) — normalização TVM
  const normalizedSender = normalizeTvmAddress(tx.from);
  const normalizedWallet = normalizeTvmAddress(walletAddress);

  if (!normalizedSender || !normalizedWallet) {
    throw new Error("Não foi possível identificar o remetente da transação.");
  }

  if (normalizedSender !== normalizedWallet) {
    throw new Error(
      `Remetente inválido. A transação foi enviada por ${tx.from}, mas a wallet autenticada é ${walletAddress}.`,
    );
  }

  // Valida o destinatário (fee_wallet configurada no backend)
  if (!requirement.feeWallet) {
    throw new Error("fee_wallet não configurada no backend. Impossível validar destino.");
  }
  const normalizedDst = normalizeTvmAddress(tx.to);
  const normalizedFeeWallet = normalizeTvmAddress(requirement.feeWallet);

  if (normalizedDst !== normalizedFeeWallet) {
    throw new Error(
      `Destinatário incorreto. Envie para a fee wallet: ${requirement.feeWallet}`,
    );
  }

  // Valida que o token é SHELL (nativo)
  const txTokenSymbol = normalizeTokenSymbol(tx.token?.symbol || "SHELL");

  if (txTokenSymbol !== "SHELL") {
    throw new Error(
      `Token incorreto. O pagamento deve ser feito em SHELL, mas foi detectado ${txTokenSymbol}.`,
    );
  }

  if (tx.paymentSource !== "shell_ecc") {
    throw new Error(
      "Pagamento inválido. A fee de criação deve ser enviada como SHELL ECC " +
        "(msg.currencies[2]); msg.value/VMSHELL é aceito apenas para gas.",
    );
  }

  // M-04: Validate that shell amount is not negative before sanitizing with regex
  const rawShellAmount = String(tx.shellNanoAmount || "0");
  if (rawShellAmount.startsWith("-")) {
    throw new Error("Valor de pagamento inválido (negativo). Transação potencialmente malformada.");
  }
  const receivedNano = BigInt(rawShellAmount.replace(/\D/g, "") || "0");
  
  // Launch Boost: +500 SHELL if boosted
  const baseFee = Number(requirement.minimumAmount);
  const totalRequired = isBoosted ? baseFee + 500 : baseFee;
  const requiredNano = BigInt(totalRequired) * 1_000_000_000n;

  if (receivedNano < requiredNano) {
    throw new Error(
      `Valor insuficiente. Mínimo exigido: ${totalRequired} SHELL. ` +
        `Recebido: ${tx.amount} SHELL.`,
    );
  }

  return {
    success: true,
    txHash,
    walletAddress: normalizedWallet,
    payerWallet: normalizedSender,
    tokenSymbol: "SHELL",
    amount: Number(tx.amount),
    nanoAmount: receivedNano.toString(),
    feeWallet: requirement.feeWallet,
    minimumAmount: requirement.minimumAmount,
    networkSettlementToken: "SHELL",
    networkSettlementStatus: "native_shell_direct",
  };
}

module.exports = { verifyPayment };
