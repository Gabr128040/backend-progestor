const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Habilita CORS para permitir que seu frontend (na Netlify) acesse este backend
app.use(cors());
app.use(express.json());

// 1. Endpoint de verificação de status
app.get('/api/pierre/status', (req, res) => {
  const pierreApiKey = process.env.PIERRE_API_KEY;
  const isKeyConfigured = Boolean(pierreApiKey && pierreApiKey.trim().length > 0);

  res.json({
    status: 'ok',
    isKeyConfigured,
    message: isKeyConfigured
      ? 'Chave do Pierre Finance configurada com segurança no servidor.'
      : 'Modo de simulação seguro ativo.',
    provider: 'Pierre MCP / Open Finance',
    bank: 'Nubank'
  });
});

// 2. Consulta de Conta / Saldo no Pierre Finance
app.get('/api/pierre/account', async (req, res) => {
  const pierreApiKey = process.env.PIERRE_API_KEY;

  if (pierreApiKey) {
    try {
      const response = await fetch('https://api.pierre.finance/v1/accounts/summary', {
        headers: {
          'Authorization': `Bearer ${pierreApiKey}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        return res.json({ source: 'live', account: data });
      }
    } catch (err) {
      console.warn('Erro ao conectar na API do Pierre, usando dados de simulação:', err.message);
    }
  }

  // Dados simulados caso a chave não esteja configurada ou a API esteja indisponível
  return res.json({
    source: 'simulated',
    account: {
      bankName: 'Nu Pagamentos S.A.',
      balance: 3480.50,
      agency: '0001',
      accountNumber: '98412-3'
    }
  });
});

// 3. Consulta de Transações do Pierre Finance
app.get('/api/pierre/transactions', async (req, res) => {
  const pierreApiKey = process.env.PIERRE_API_KEY;
  let rawList = [];

  if (pierreApiKey) {
    try {
      const response = await fetch('https://api.pierre.finance/v1/transactions?limit=50', {
        headers: {
          'Authorization': `Bearer ${pierreApiKey}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        rawList = data.transactions || data;
      }
    } catch (err) {
      console.warn('Erro na consulta de transações Pierre:', err.message);
    }
  }

  res.json({ transactions: rawList });
});

app.listen(PORT, () => {
  console.log(`Servidor Backend rodando na porta ${PORT}`);
});
