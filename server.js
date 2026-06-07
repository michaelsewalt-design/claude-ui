/**
 * SERVER.JS — Node.js / Express proxy server
 * =============================================
 * Beveiliging: API key wordt NOOIT naar de client gestuurd.
 * Draai dit op jouw server, niet client-side.
 *
 * Installatie:
 *   npm install express cors dotenv
 *
 * .env bestand:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   PORT=3000
 *   ALLOWED_ORIGIN=https://jouwdomein.nl
 *
 * Starten:
 *   node server.js
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY is niet ingesteld in .env');
  process.exit(1);
}

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Statische bestanden (je HTML/CSS/JS)
// app.use(express.static('public')); // Zet je claude-ui bestanden in /public

// ─── Rate limiting (simpel) ───────────────────────────────────
const requestLog = new Map();
const RATE_LIMIT = 30; // verzoeken per uur

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 3600000; // 1 uur
  const requests = (requestLog.get(ip) || []).filter(t => t > windowStart);
  requests.push(now);
  requestLog.set(ip, requests);
  return requests.length <= RATE_LIMIT;
}

// ─── API proxy endpoint ───────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  // Rate limit check
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: { message: 'Te veel verzoeken. Probeer het later opnieuw.' } });
  }

  const { model, max_tokens, system, messages } = req.body;

  // Basisvalidatie
  if (!model || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: { message: 'Ongeldige aanvraag.' } });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.min(max_tokens || 4096, 8192),
        system,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);

  } catch (err) {
    console.error('API fout:', err);
    res.status(500).json({ error: { message: 'Interne serverfout.' } });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`✅ Server draait op http://localhost:${PORT}`);
  console.log(`   API endpoint: http://localhost:${PORT}/api/chat`);
});
module.exports = app;
