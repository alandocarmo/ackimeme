// Este módulo é uma versão alternativa/simplificada de payments.
// O fluxo principal usa backend/src/payments.js.
// Mantido aqui apenas como referência — não é importado pelo main.js.

const { getTransaction } = require('../services/graphql.service');

async function verifyPaymentSimple(wallet, tx) {
  const data = await getTransaction(tx);

  if (!data) throw new Error('Tx not found');
  if (data.from !== wallet) throw new Error('Invalid sender');
  if (data.token?.symbol !== 'SHELL') throw new Error('Wrong token');
  if (Number(data.amount) < 3) throw new Error('Insufficient');

  return true;
}

module.exports = { verifyPaymentSimple };
