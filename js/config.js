/**
 * CONFIG.JS
 * Pas deze instellingen aan naar jouw server-setup.
 * De API key wordt server-side beveiligd en nooit blootgesteld aan de client.
 */

const CONFIG = {
  /**
   * API endpoint - vervang door jouw server-side proxy URL
   * Voorbeeld: '/api/chat', 'https://jouwserver.nl/api/claude', etc.
   * De proxy stuurt de requests door naar Anthropic met de API key.
   */
  API_ENDPOINT: '/api/chat', // ← PLACEHOLDER: vervang door jouw endpoint

  /**
   * Maximaal aantal tokens per antwoord
   */
  MAX_TOKENS: 4096,

  /**
   * Maximale bestandsgrootte voor uploads (bytes)
   * Standaard: 10 MB
   */
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  /**
   * Ondersteunde bestandstypen voor upload
   */
  SUPPORTED_FILE_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp'
  ],

  /**
   * Standaard model bij opstarten
   */
  DEFAULT_MODEL: 'claude-opus-4-6',

  /**
   * Standaard systeemprompt
   */
  SYSTEM_PROMPT: `Je bent een behulpzame, nauwkeurige AI-assistent. 
Geef duidelijke, gestructureerde en professionele antwoorden.
Wanneer een uitvoerformaat is opgegeven, pas je de opmaak van je antwoord aan op dat formaat.`
};
