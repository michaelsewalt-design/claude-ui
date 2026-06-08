/**
 * API.JS — v2
 * Claude API communicatie met automatische continuation chaining.
 *
 * Wanneer Claude stopt vanwege max_tokens (antwoord afgekapt),
 * stuurt deze module automatisch een vervolg-request totdat
 * het volledige antwoord is ontvangen (stop_reason = "end_turn").
 *
 * Visuele indicator via optionele onProgress callback:
 *   onProgress('continuing', partialText)  → toon "Continuing…" indicator
 *   onProgress('done', fullText)           → verberg indicator
 */

const API = (() => {

  // Maximum aantal automatische vervolgvragen (veiligheidsgrens)
  const MAX_CONTINUATIONS = 8;

  // ─── Eén API call ─────────────────────────────────────────────
  async function callOnce(messages, model, systemPrompt) {
    let response;
    try {
      response = await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      model,
          max_tokens: CONFIG.MAX_TOKENS,
          system:     systemPrompt || CONFIG.SYSTEM_PROMPT,
          messages:   messages
        })
      });
    } catch (networkError) {
      throw new Error('Cannot reach the server. Check your internet connection or server configuration.');
    }

    if (!response.ok) {
      let errMsg = `Server error: ${response.status}`;
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
      throw new Error('Invalid response from server (not valid JSON).');
    }

    // Haal tekst en stop_reason op
    let text = '';
    if (data.content && Array.isArray(data.content)) {
      const block = data.content.find(b => b.type === 'text');
      if (block) text = block.text;
    }
    if (!text && typeof data.text === 'string')     text = data.text;
    if (!text && typeof data.response === 'string') text = data.response;
    if (!text && typeof data.message === 'string')  text = data.message;

    const stopReason = data.stop_reason || 'end_turn';

    return { text, stopReason };
  }

  // ─── Hoofd sendMessage met chaining ───────────────────────────
  /**
   * @param {Array}    messages     - Conversatiegeschiedenis
   * @param {string}   model        - Model ID
   * @param {string}   systemPrompt - Systeem instructies
   * @param {Function} onProgress   - Optionele callback (status, partialText)
   *                                  status: 'continuing' | 'done'
   * @returns {Promise<string>} - Volledig antwoord
   */
  async function sendMessage(messages, model, systemPrompt, onProgress) {
    let fullText        = '';
    let continuations   = 0;
    let currentMessages = [...messages];

    while (true) {
      const { text, stopReason } = await callOnce(currentMessages, model, systemPrompt);

      fullText += text;

      // Klaar — geen afkapping
      if (stopReason !== 'max_tokens') {
        if (onProgress) onProgress('done', fullText);
        return fullText;
      }

      // Afgekapt — check veiligheidsgrens
      continuations++;
      if (continuations >= MAX_CONTINUATIONS) {
        // Stop veilig, stuur terug wat we hebben + melding
        if (onProgress) onProgress('done', fullText);
        return fullText + '\n\n*[Response truncated after ' + MAX_CONTINUATIONS + ' continuations.]*';
      }

      // Signaleer voortgang aan de UI
      if (onProgress) onProgress('continuing', fullText);

      // Bouw vervolgconversatie:
      // Voeg het afgekapte antwoord toe als assistant-bericht,
      // daarna een user-bericht dat vraagt door te gaan.
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: fullText },
        { role: 'user',      content: 'Please continue your response exactly where you left off. Do not repeat anything, just continue from the exact point where the text was cut off.' }
      ];
    }
  }

  // ─── Bestandsinhoud lezen voor de API ─────────────────────────
  /**
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
            type:   'image',
            source: { type: 'base64', media_type: file.type, data: base64 }
          });
        };
        reader.readAsDataURL(file);

      } else if (file.type === 'application/pdf') {
        reader.onload = e => {
          const base64 = e.target.result.split(',')[1];
          resolve({
            type:   'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          });
        };
        reader.readAsDataURL(file);

      } else {
        // Tekstbestanden (txt, md, csv, json, docx, etc.)
        reader.onload = e => {
          resolve({
            type: 'text',
            text: '[File: ' + file.name + ']\n\n' + e.target.result
          });
        };
        reader.readAsText(file);
      }

      reader.onerror = () => reject(new Error('Cannot read file: ' + file.name));
    });
  }

  return { sendMessage, readFileForAPI };

})();