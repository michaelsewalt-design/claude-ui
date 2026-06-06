/**
 * API.JS
 * Communicatie met de Claude API via de server-side proxy
 */

const API = (() => {
  /**
   * Verstuur een bericht naar Claude
   * @param {Array} messages - Conversatiegeschiedenis
   * @param {string} model - Model ID
   * @param {string} systemPrompt - Systeem instructies
   * @returns {Promise<string>} - Antwoord van Claude
   */
  async function sendMessage(messages, model, systemPrompt) {
    const payload = {
      model: model,
      max_tokens: CONFIG.MAX_TOKENS,
      system: systemPrompt || CONFIG.SYSTEM_PROMPT,
      messages: messages
    };

    let response;
    try {
      response = await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (networkError) {
      throw new Error('Kan de server niet bereiken. Controleer je internetverbinding of server-configuratie.');
    }

    if (!response.ok) {
      let errMsg = `Server fout: ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData.error?.message || errData.message || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw new Error('Ongeldig antwoord van de server (geen geldige JSON).');
    }

    // Anthropic API response structuur
    if (data.content && Array.isArray(data.content)) {
      const textBlock = data.content.find(b => b.type === 'text');
      if (textBlock) return textBlock.text;
    }

    // Fallback: directe tekst via proxy
    if (typeof data.text === 'string') return data.text;
    if (typeof data.response === 'string') return data.response;
    if (typeof data.message === 'string') return data.message;

    throw new Error('Onverwachte antwoordstructuur van de API.');
  }

  /**
   * Lees bestandsinhoud voor de API
   * @param {File} file
   * @returns {Promise<Object>} - Content block voor Anthropic API
   */
  async function readFileForAPI(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (file.type.startsWith('image/')) {
        reader.onload = e => {
          const base64 = e.target.result.split(',')[1];
          resolve({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.type,
              data: base64
            }
          });
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        reader.onload = e => {
          const base64 = e.target.result.split(',')[1];
          resolve({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64
            }
          });
        };
        reader.readAsDataURL(file);
      } else {
        // Tekstbestanden
        reader.onload = e => {
          resolve({
            type: 'text',
            text: `[Bestand: ${file.name}]\n\n${e.target.result}`
          });
        };
        reader.readAsText(file);
      }

      reader.onerror = () => reject(new Error(`Kan bestand niet lezen: ${file.name}`));
    });
  }

  return { sendMessage, readFileForAPI };
})();
