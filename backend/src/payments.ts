/**
 * payments.ts
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

import { getTransaction } from "./services/graphql.service";
import { getCreationFeeRequirement, normalizeTokenSymbol } from "./treasury";

/**
 * Normaliza endereço TVM Acki Nacki: lowercase, trim, sem espaços.
 * Formato padrão: "0:hex64"
 */
export function normalizeTvmAddress(value: any): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

interface VerifyPaymentParams {
  walletAddress: string;
  txHash: string;
  tokenSymbol: string;
  isBoosted?: boolean;
}

interface VerifiedPaymentResult {
  success: boolean;
  txHash: string;
  walletAddress: string;
  payerWallet: string;
  tokenSymbol: string;
  amount: any;
  nanoAmount: string;
  feeWallet: string;
  minimumAmount: any;
  networkSettlementToken: string;
  networkSettlementStatus: string;
}

/**
 * Verifica se uma transação SHELL cumpre os requisitos de fee.
 */
export async function verifyPayment({
  walletAddress,
  txHash,
  tokenSymbol,
  isBoosted = false,
}: VerifyPaymentParams): Promise<VerifiedPaymentResult> {
  const requirement = getCreationFeeRequirement(tokenSymbol || "SHELL");

  let tx: any;
  try {
    tx = await getTransaction(txHash);
  } catch (error: any) {
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
  if (!/^\d+$/.test(rawShellAmount)) {
    throw new Error("Formato numérico inválido para o valor do pagamento.");
  }
  const receivedNano = BigInt(rawShellAmount);
  
  // Launch Boost: +500 SHELL if boosted
  const baseFee = BigInt(requirement.minimumAmount);
  const totalRequired = isBoosted ? baseFee + 500n : baseFee;
  const requiredNano = totalRequired * 1_000_000_000n;

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
    amount: tx.amount,
    nanoAmount: receivedNano.toString(),
    feeWallet: requirement.feeWallet,
    minimumAmount: requirement.minimumAmount,
    networkSettlementToken: "SHELL",
    networkSettlementStatus: "native_shell_direct",
  };
}
