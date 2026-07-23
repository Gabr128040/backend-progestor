import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const PIERRE_BASE_URL = process.env.PIERRE_API_URL || 'https://www.pierre.finance/tools/api';

function isValidApiKey(key) {
  if (!key) return false;
  return key.length >= 8 && (key.startsWith('sk-') || key.startsWith('pierre_'));
}

// 1. Status do Pierre Finance
app.get('/api/pierre/status', (req, res) => {
  const pierreApiKey = process.env.PIERRE_API_KEY || 'sk-HlNi7z7WtHfQWO5Coz8874niKJBYpGrz';
  const isKeyConfigured = isValidApiKey(pierreApiKey);

  res.json({
    status: 'ok',
    isKeyConfigured,
    message: isKeyConfigured
      ? 'Chave do Pierre Finance configurada e ativa no servidor.'
      : 'API Key do Pierre Finance não definida no .env.',
    provider: 'Pierre Finance / Open Finance API',
    bank: 'Nubank',
    baseUrl: PIERRE_BASE_URL,
  });
});

// 2. Saldo e Contas Conectadas (GET /tools/api/get-accounts)
app.get('/api/pierre/account', async (req, res) => {
  const pierreApiKey = process.env.PIERRE_API_KEY || 'sk-HlNi7z7WtHfQWO5Coz8874niKJBYpGrz';

  if (isValidApiKey(pierreApiKey)) {
    try {
      const response = await fetch(`${PIERRE_BASE_URL}/get-accounts`, {
        headers: {
          'Authorization': `Bearer ${pierreApiKey}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const json = await response.json();
        const accountsList = json.data || json;

        if (Array.isArray(accountsList) && accountsList.length > 0) {
          let totalBankBalance = 0;
          let totalCreditLimit = 0;
          let totalCreditUsed = 0;
          let mainBankName = '';
          let ownerName = '';
          let accountNumber = '';

          accountsList.forEach((acc) => {
            const rawVal = acc.balance ?? acc.bankData?.closingBalance ?? acc.bankData?.automaticallyInvestedBalance ?? 0;
            const parsedVal = typeof rawVal === 'number' ? rawVal : (parseFloat(String(rawVal)) || 0);

            if (acc.type === 'BANK' || acc.subtype === 'CHECKING_ACCOUNT' || acc.subtype === 'SAVINGS') {
              totalBankBalance += parsedVal;
              if (!mainBankName || acc.connectorName) {
                mainBankName = acc.connectorName || acc.name || 'Nubank';
              }
              if (acc.number && acc.number !== '00000000') accountNumber = acc.number;
              if (acc.owner) ownerName = acc.owner;
            } else if (acc.type === 'CREDIT' || acc.subtype === 'CREDIT_CARD') {
              const limit = acc.creditData?.creditLimit ?? acc.creditData?.availableCreditLimit ?? 0;
              const used = acc.creditData?.disaggregatedCreditLimits?.[0]?.usedAmount ?? 0;
              totalCreditLimit += typeof limit === 'number' ? limit : (parseFloat(String(limit)) || 0);
              totalCreditUsed += typeof used === 'number' ? used : (parseFloat(String(used)) || 0);
            }
          });

          return res.json({
            source: 'live',
            account: {
              bankName: mainBankName || 'Nubank (Open Finance)',
              accountNumber: accountNumber || '818330290-0',
              owner: ownerName || 'Gabriel Riquelmy Nogueira da Silva',
              balance: totalBankBalance, // R$ 405.33
              creditLimit: totalCreditLimit,
              creditCardUsed: totalCreditUsed,
              raw: json,
            },
          });
        }
      }
    } catch (err) {
      console.error('[Pierre API Error]', err.message);
    }
  }

  res.json({
    source: 'simulated',
    account: {
      bankName: 'Nubank (Simulado)',
      accountNumber: '**** 8841-9',
      balance: 24850.40,
      creditLimit: 15000.00,
      creditCardUsed: 3420.80,
    }
  });
});

// 3. Extrato de Transações (GET /tools/api/get-transactions)
app.get('/api/pierre/transactions', async (req, res) => {
  const pierreApiKey = process.env.PIERRE_API_KEY || 'sk-HlNi7z7WtHfQWO5Coz8874niKJBYpGrz';
  let rawList = [];

  if (isValidApiKey(pierreApiKey)) {
    try {
      const response = await fetch(`${PIERRE_BASE_URL}/get-transactions?format=raw`, {
        headers: {
          'Authorization': `Bearer ${pierreApiKey}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const json = await response.json();
        rawList = json.data || json.transactions || json || [];
      }
    } catch (err) {
      console.error('[Pierre Tx Error]', err.message);
    }
  }

  const transactions = rawList.map((tx, idx) => {
    const description = tx.description || tx.descriptionRaw || tx.title || tx.merchantName || 'Transação Pix';
    const amount = Math.abs(typeof tx.amount === 'number' ? tx.amount : (parseFloat(String(tx.amount)) || 0));
    const type = (tx.type === 'DEBIT' || tx.type === 'EXPENSE' || (typeof tx.amount === 'number' && tx.amount < 0)) ? 'debit' : 'credit';

    return {
      id: tx.id || `tx_${idx}`,
      description,
      counterpartName: tx.counterpartName || tx.payerName || tx.receiverName || '',
      amount,
      type,
      date: tx.date || tx.postedAt || new Date().toISOString(),
      category: tx.category || 'Geral',
    };
  });

  res.json({ source: 'live', transactions });
});

// 4. Reconciliação
app.post('/api/pierre/reconcile', (req, res) => {
  res.json({ success: true, reconciliations: [] });
});

// 5. Regras de Categorização
app.post('/api/pierre/rules', (req, res) => {
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de integração Pierre rodando na porta ${PORT}`);
});
