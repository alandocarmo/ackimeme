/**
 * payments.js
 *
 * Verificação de pagamento de fee de criação de coin.
 *
 * Fluxo:
 *   1. Usuário envia SHELL ou USDC para FEE_WALLET na Acki Nacki
 *   2. Frontend manda { walletAddress, txHash, tokenSymbol } para POST /verify-payment
 *   3. Este módulo consulta a blockchain e valida a transação
 *
 * Documentação GraphQL: https://dev.ackinacki.com/graphql/graphql-api
 * Endpoint testnet: https://shellnet.ackinacki.org/graphql
 */

const { getTransaction } = require("./services/graphql.service");
const { getCreationFeeRequirement, normalizeTokenSymbol } = require("./treasury");

/**
 * Verifica se uma transação cumpre os requisitos de fee.
 *
 * @param {{ walletAddress: string, txHash: string, tokenSymbol: string }} params
 * @returns {Promise<object>} Dados do pagamento verificado
 */
async function verifyPayment({ walletAddress, txHash, tokenSymbol }) {
  const requirement = getCreationFeeRequirement(tokenSymbol);

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
  if (requirement.feeWallet) {
    const normalizedDst = String(tx.to || "").trim().toLowerCase();
    const normalizedFeeWallet = String(requirement.feeWallet || "").trim().toLowerCase();

    if (normalizedDst !== normalizedFeeWallet) {
      throw new Error(
        `Destinatário incorreto. Envie para a fee wallet: ${requirement.feeWallet}`,
      );
    }
  }

  // Valida token
  // Na Acki Nacki, o token nativo é SHELL. Suporte a USDC via TIP-3 é pendente.
  const txTokenSymbol = normalizeTokenSymbol(tx.token?.symbol || "SHELL");

  if (txTokenSymbol !== requirement.tokenSymbol) {
    throw new Error(
      `Token incorreto. O pagamento deve ser feito em ${requirement.tokenSymbol}, mas foi detectado ${txTokenSymbol}.`,
    );
  }

  // Valida valor mínimo
  if (Number(tx.amount) < requirement.minimumAmount) {
    throw new Error(
      `Valor insuficiente. Mínimo exigido: ${requirement.minimumAmount} ${requirement.tokenSymbol}. ` +
        `Recebido: ${tx.amount} ${requirement.tokenSymbol}.`,
    );
  }

  return {
    success: true,
    txHash,
    tokenSymbol: requirement.tokenSymbol,
    amount: Number(tx.amount),
    feeWallet: requirement.feeWallet,
    minimumAmount: requirement.minimumAmount,
    networkSettlementToken: requirement.networkSettlementToken,
    networkSettlementStatus: requirement.networkSettlementStatus,
  };
}

module.exports = { verifyPayment };
