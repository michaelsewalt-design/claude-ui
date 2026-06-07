/**
 * SERVER.JS — met wachtwoordbeveiliging
 * =======================================
 * Beveiliging via sessie-cookie na inloggen.
 * Niemand kan de app gebruiken zonder het juiste wachtwoord.
 *
 * Installatie:
 *   npm install express cors dotenv cookie-parser
 *
 * .env / Vercel Environment Variables:
 *   ANTHROPIC_API_KEY = sk-ant-...
 *   LOGIN_PASSWORD    = kies-een-sterk-wachtwoord
 *   SESSION_SECRET    = willekeurige-lange-string
 *   PORT              = 3000
 */

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const crypto       = require('crypto');
const path         = require('path');

const app           = express();
const PORT          = process.env.PORT          || 3000;
const API_KEY       = process.env.ANTHROPIC_API_KEY;
const PASSWORD      = process.env.LOGIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || 'verander-dit-naar-iets-geheims';

if (!API_KEY)  { console.error('ANTHROPIC_API_KEY niet ingesteld'); process.exit(1); }
if (!PASSWORD) { console.error('LOGIN_PASSWORD niet ingesteld');     process.exit(1); }

// ─── Token generatie ──────────────────────────────────────────
// Maak een gesigneerde token op basis van het wachtwoord + secret
function generateToken() {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(PASSWORD)
    .digest('hex');
}

const VALID_TOKEN = generateToken();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: false })); // geen cross-origin voor beveiligde app
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// ─── Auth middleware ──────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies['claude_session'];
  if (token && token === VALID_TOKEN) {
    return next(); // ingelogd
  }
  // Niet ingelogd → stuur naar loginpagina
  res.redirect('/login');
}

// ─── Login pagina ─────────────────────────────────────────────
app.get('/login', (req, res) => {
  // Al ingelogd? Stuur door naar de app
  const token = req.cookies && req.cookies['claude_session'];
  if (token === VALID_TOKEN) return res.redirect('/');

  res.send(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude AI — Inloggen</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #0d0d0f;
      color: #f0efee;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #111114;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 380px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 32px;
      justify-content: center;
    }
    .logo-mark { color: #e8c547; font-size: 24px; }
    .logo-text { font-size: 20px; font-weight: 700; letter-spacing: 0.04em; }
    h1 {
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 8px;
      color: #f0efee;
    }
    p {
      font-size: 13px;
      color: #9b9aa0;
      text-align: center;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    label {
      display: block;
      font-size: 11px;
      font-family: monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #5c5b62;
      margin-bottom: 8px;
    }
    input[type="password"] {
      width: 100%;
      background: #18181c;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 12px 14px;
      color: #f0efee;
      font-size: 15px;
      outline: none;
      transition: border-color 0.15s;
      margin-bottom: 16px;
      letter-spacing: 0.1em;
    }
    input[type="password"]:focus { border-color: #e8c547; }
    button {
      width: 100%;
      background: #e8c547;
      border: none;
      border-radius: 8px;
      padding: 12px;
      color: #0d0d0f;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
      letter-spacing: 0.02em;
    }
    button:hover { background: #f0d060; }
    .error {
      background: rgba(224,92,92,0.12);
      border: 1px solid rgba(224,92,92,0.25);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      color: #e07070;
      margin-bottom: 16px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span class="logo-mark">&#9670;</span>
      <span class="logo-text">Claude AI</span>
    </div>
    <h1>Privé toegang</h1>
    <p>Voer het wachtwoord in om toegang te krijgen.</p>
    ${req.query.error ? '<div class="error">Onjuist wachtwoord. Probeer opnieuw.</div>' : ''}
    <form method="POST" action="/login">
      <label for="password">Wachtwoord</label>
      <input type="password" id="password" name="password" autocomplete="current-password" autofocus placeholder="••••••••" />
      <button type="submit">Inloggen</button>
    </form>
  </div>
</body>
</html>`);
});

// ─── Login verwerken ──────────────────────────────────────────
app.post('/login', express.urlencoded({ extended: false }), (req, res) => {
  const { password } = req.body;

  if (password === PASSWORD) {
    // Correct wachtwoord → sla sessie-cookie op (30 dagen)
    res.cookie('claude_session', VALID_TOKEN, {
      httpOnly: true,                        // niet toegankelijk via JS
      secure:   process.env.NODE_ENV === 'production', // alleen HTTPS in productie
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000    // 30 dagen in ms
    });
    res.redirect('/');
  } else {
    // Fout wachtwoord
    res.redirect('/login?error=1');
  }
});

// ─── Uitloggen ────────────────────────────────────────────────
app.get('/logout', (req, res) => {
  res.clearCookie('claude_session');
  res.redirect('/login');
});

// ─── Statische bestanden (beveiligd) ─────────────────────────
// Alleen toegankelijk na inloggen
app.use(requireAuth, express.static(path.join(__dirname, 'public')));

// ─── Rate limiting ────────────────────────────────────────────
const requestLog = new Map();
const RATE_LIMIT  = 60; // verzoeken per uur

function checkRateLimit(ip) {
  const now         = Date.now();
  const windowStart = now - 3600000;
  const requests    = (requestLog.get(ip) || []).filter(t => t > windowStart);
  requests.push(now);
  requestLog.set(ip, requests);
  return requests.length <= RATE_LIMIT;
}

// ─── API proxy (beveiligd) ────────────────────────────────────
app.post('/api/chat', requireAuth, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: { message: 'Te veel verzoeken. Probeer het later opnieuw.' } });
  }

  const { model, max_tokens, system, messages } = req.body;

  if (!model || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: { message: 'Ongeldige aanvraag.' } });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
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
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);

  } catch (err) {
    console.error('API fout:', err);
    res.status(500).json({ error: { message: 'Interne serverfout.' } });
  }
});

// ─── Health check (openbaar) ─────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── Catch-all: stuur niet-gevonden routes naar login ─────────
app.use((req, res) => res.redirect('/login'));

app.listen(PORT, () => {
  console.log('Server draait op http://localhost:' + PORT);
});
