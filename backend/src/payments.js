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
 * Verifica se uma transação SHELL cumpre os requisitos de fee.
 *
 * @param {{ walletAddress: string, txHash: string, tokenSymbol: string }} params
 * @returns {Promise<object>} Dados do pagamento verificado
 */
async function verifyPayment({ walletAddress, txHash, tokenSymbol }) {
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

  // Valida o remetente (quem enviou a fee)
  const normalizedSender = String(tx.from || "").trim().toLowerCase();
  const normalizedWallet = String(walletAddress || "").trim().toLowerCase();

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
  const normalizedDst = String(tx.to || "").trim().toLowerCase();
  const normalizedFeeWallet = String(requirement.feeWallet || "").trim().toLowerCase();

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

  // Valida valor mínimo
  if (Number(tx.amount) < requirement.minimumAmount) {
    throw new Error(
      `Valor insuficiente. Mínimo exigido: ${requirement.minimumAmount} SHELL (~$3 USD). ` +
        `Recebido: ${tx.amount} SHELL.`,
    );
  }

  return {
    success: true,
    txHash,
    tokenSymbol: "SHELL",
    amount: Number(tx.amount),
    feeWallet: requirement.feeWallet,
    minimumAmount: requirement.minimumAmount,
    networkSettlementToken: "SHELL",
    networkSettlementStatus: "native_shell_direct",
  };
}

module.exports = { verifyPayment };
