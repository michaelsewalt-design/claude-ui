# claude-ui
Eerste versie eigen Claude UI
# ◆ Claude AI — Persoonlijke Interface

Persoonlijke web-interface voor Claude AI. Server-side API key beveiliging, documentuploads, uitvoerformaten en chat-export.

---

## Bestandsstructuur

```
claude-ui/
├── index.html          ← Hoofd HTML
├── css/
│   └── style.css       ← Alle stijlen
├── js/
│   ├── config.js       ← Instellingen & API endpoint
│   ├── models.js       ← Modellen & uitvoerformaten
│   ├── api.js          ← API communicatie
│   ├── export.js       ← Export naar .docx/.pdf/.html etc.
│   ├── ui.js           ← DOM rendering
│   └── app.js          ← Hoofd applicatielogica
├── server.js           ← Node.js proxy server
├── package.json
└── .env.example        ← Kopieer naar .env
```

---

## Snelstart

### 1. Server instellen

```bash
# Vereisten: Node.js 18+
npm install

# Maak .env aan
cp .env.example .env

# Vul je API key in .env
# ANTHROPIC_API_KEY=sk-ant-...

# Start server
npm start
```

### 2. Frontend deployen

**Optie A — Via de Node.js server (aanbevolen):**
- Zet alle frontend bestanden in een `/public` map
- De server serveert ze automatisch op `http://localhost:3000`

**Optie B — Aparte webserver (Nginx/Apache/Cloudflare Pages):**
- Zet de frontend bestanden op je webserver
- Pas `API_ENDPOINT` in `js/config.js` aan naar je server-URL

**Optie C — Lokaal testen:**
- Open `index.html` direct in de browser
- Pas `API_ENDPOINT` aan naar `http://localhost:3000/api/chat`

---

## Configuratie

Pas `js/config.js` aan voor:
- `API_ENDPOINT` — URL van je proxy server
- `MAX_TOKENS` — Max tokens per antwoord (standaard 4096)
- `DEFAULT_MODEL` — Standaard Claude model
- `SYSTEM_PROMPT` — Systeem instructies

---

## Functies

| Functie | Details |
|---|---|
| **3 Claude modellen** | Opus 4.6 · Sonnet 4.6 · Haiku 4.5 |
| **Document upload** | PDF · DOCX · TXT · MD · CSV · JSON · PNG · JPG |
| **Uitvoerformaten** | Geen · Markdown · HTML · Word · PDF · JSON · CSV · Platte tekst |
| **Chat export** | .docx · .pdf · .html · .md · .txt · .json · .csv |
| **Sessie statistieken** | Berichtteller · geschatte tokens |
| **Veiligheid** | API key alleen server-side, CORS-beveiliging, rate limiting |

---

## .docx Export

De .docx export werkt **zonder externe libraries** via directe XML-generatie.

Voor rijkere .docx opmaak (tabellen, stijlen, afbeeldingen): voeg [JSZip](https://stuk.github.io/jszip/) toe via CDN in `index.html`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

---

## Veiligheid productie

- Zet `ALLOWED_ORIGIN` in `.env` op je exacte domein
- Gebruik HTTPS voor zowel frontend als server
- Voeg `.env` toe aan `.gitignore`
- Overweeg authenticatie toe te voegen voor publieke servers
