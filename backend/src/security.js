const express = require('express');
const router = express.Router();

// Mock behavior scores to present the conceptual anti-bot ML to investors.
const MOCK_ANOMALIES = [
  { wallet: "0:xyz123...", type: "SNIPER", score: 98, triggers: ["High frequency swap", "Instant block purchase"], ip: "192.168.1.55" },
  { wallet: "0:abc999...", type: "SANDWICH_BOT", score: 85, triggers: ["Mempool reading anomaly"], ip: "200.150.12.3" },
  { wallet: "0:fdf444...", type: "RUG_ATTEMPT", score: 92, triggers: ["Liquidity pull simulation detected"], ip: "10.0.0.5" },
];

const MOCK_VIRAL_RANK = [
  { token: "Pepe TVM", score: 99.5, speed: "+1400%", source: "Twitter" },
  { token: "Acki Dog", score: 88.2, speed: "+450%", source: "Telegram" },
];

router.get('/anomalies', (req, res) => {
  res.json({
    success: true,
    anomalies: MOCK_ANOMALIES
  });
});

router.get('/viral-ranking', (req, res) => {
  res.json({
    success: true,
    ranking: MOCK_VIRAL_RANK
  });
});

module.exports = router;
