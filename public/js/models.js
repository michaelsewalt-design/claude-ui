/**
 * MODELS.JS
 * Claude model definities met beschrijvingen en metadata
 */

const MODELS = [
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    tag: 'flagship',
    tagLabel: 'Flagship',
    description: 'Meest capabele model. Uitstekend voor complexe analyses, lange documenten en creatief schrijven. Maximale nauwkeurigheid en diepgang.',
    contextWindow: '200K tokens',
    speed: 'Gemiddeld'
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    tag: 'efficient',
    tagLabel: 'Balanced',
    description: 'Optimale balans tussen intelligentie en snelheid. Geschikt voor de meeste dagelijkse taken: rapportage, samenvatting en tekstverwerking.',
    contextWindow: '200K tokens',
    speed: 'Snel'
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    tag: 'fast',
    tagLabel: 'Snel',
    description: 'Lichtste en snelste model. Ideaal voor korte vragen, snelle bewerkingen en interactieve gesprekken waar reactiesnelheid prioriteit heeft.',
    contextWindow: '200K tokens',
    speed: 'Zeer snel'
  }
];

// Uitvoerformaten voor de API-instructie
const OUTPUT_FORMATS = [
  {
    id: 'none',
    label: 'Geen',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    instruction: '',
    extension: null
  },
  {
    id: 'markdown',
    label: 'Markdown',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-7"/><path d="M8 12v5"/><path d="M8 12l2-2 2 2"/><path d="M14 15V10l3 3 3-3v5"/></svg>`,
    instruction: 'Gebruik Markdown opmaak in je antwoord: koppen (##), lijsten, **vet**, *cursief*, tabellen en codeblokken waar passend.',
    extension: '.md'
  },
  {
    id: 'html',
    label: 'HTML',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    instruction: 'Structureer je antwoord als volledige, geldige HTML met semantische tags (h1-h3, p, ul, ol, table, strong, em, code). Gebruik geen externe stijlen of scripts. Geef ALLEEN de HTML-inhoud terug, geen uitleg buiten de HTML.',
    extension: '.html'
  },
  {
    id: 'doc',
    label: 'Word (.docx)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    instruction: 'Structureer je antwoord als een professioneel Word-document met duidelijke koppen, alinea\'s en een logische documentstructuur.',
    extension: '.docx'
  },
  {
    id: 'pdf',
    label: 'PDF',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-4h6v4"/><path d="M9 11h6"/></svg>`,
    instruction: 'Geef een duidelijk gestructureerd antwoord met koppen, paragrafen en opsommingen geschikt voor een PDF-document. Gebruik Markdown voor opmaak.',
    extension: '.pdf'
  },
  {
    id: 'excel',
    label: 'Excel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/><path d="M6 12l3 3-3 3M15 12h3"/></svg>`,
    instruction: 'Geef je antwoord ALS TABEL-DATA die geschikt is voor Excel. Gebruik een duidelijke structuur met kolomkoppen in de eerste rij. Geef de data terug als JSON-array waarbij het eerste element de kolomkoppen bevat en de volgende elementen de rijen zijn. Geef ALLEEN de JSON-array terug, geen uitleg of Markdown. Voorbeeld: [["Naam","Waarde","Categorie"],["Item 1","100","A"],["Item 2","200","B"]]',
    extension: '.xlsx'
  },
  {
    id: 'json',
    label: 'JSON',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
    instruction: 'Geef je antwoord ALLEEN als geldig JSON-object terug. Geen uitleg, geen Markdown, geen tekst buiten het JSON-object. Structureer de data logisch met passende sleutels.',
    extension: '.json'
  },
  {
    id: 'csv',
    label: 'CSV',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>`,
    instruction: 'Geef je antwoord ALLEEN als CSV-data terug. Gebruik komma als scheidingsteken. Eerste rij = kolomkoppen. Geen uitleg buiten de CSV-data.',
    extension: '.csv'
  },
  {
    id: 'txt',
    label: 'Platte tekst',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>`,
    instruction: 'Geef je antwoord als platte tekst zonder opmaak. Geen Markdown, geen HTML. Gebruik alleen tekst en witruimte.',
    extension: '.txt'
  }
];
