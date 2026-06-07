/**
 * EXPORT.JS — v4
 * Volledige chat exporteren + enkel antwoord downloaden.
 * Nieuw: Excel (.xlsx) export via SheetJS
 * Vereist: js/jszip.min.js + js/xlsx.full.min.js (beide lokaal)
 */

const Exporter = (() => {

  // ─── Hulpfuncties ─────────────────────────────────────────────

  function formatTimestamp(isoString) {
    return new Date(isoString).toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' });
  }

  function generateFilename(ext) {
    return `claude-chat_${new Date().toISOString().slice(0, 10)}${ext}`;
  }

  function generateSingleFilename(ext) {
    return `claude-antwoord_${new Date().toISOString().slice(0, 10)}${ext}`;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function getTextContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    return '';
  }

  function stripMarkdown(text) {
    return text
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{1,3}([\s\S]*?)`{1,3}/g, '$1')
      .replace(/^\s*[-*+]\s/gm, '• ')
      .replace(/^\s*\d+\.\s/gm, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/^>\s?(.*)/gm, '$1')
      .replace(/---+/g, '─'.repeat(40))
      .trim();
  }

  function markdownToHtml(text) {
    let h = text
      .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s(.+)$/gm,  '<h5>$1</h5>')
      .replace(/^####\s(.+)$/gm,   '<h4>$1</h4>')
      .replace(/^###\s(.+)$/gm,    '<h3>$1</h3>')
      .replace(/^##\s(.+)$/gm,     '<h2>$1</h2>')
      .replace(/^#\s(.+)$/gm,      '<h1>$1</h1>')
      .replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>')
      .replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,        '<em>$1</em>')
      .replace(/`([^`]+)`/g,        '<code>$1</code>')
      .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/^>\s(.+)$/gm,       '<blockquote>$1</blockquote>')
      .replace(/^---+$/gm,          '<hr>')
      .replace(/^\s*[-*+]\s(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/^\d+\.\s(.+)$/gm,   '<li>$1</li>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return `<p>${h}</p>`;
  }

  // ─── EXCEL export via SheetJS ─────────────────────────────────

  /**
   * Probeer de tekst te parsen als JSON-array (zoals Claude retourneert
   * bij Excel-formaat instructie). Fallback: splits op regels en tabs/kommas.
   */
  function parseToTableData(text) {
    const clean = text.trim();

    // Poging 1: JSON array van arrays
    try {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(row => Array.isArray(row) ? row : [String(row)]);
      }
    } catch (_) {}

    // Poging 2: JSON in code block
    const jsonMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (Array.isArray(parsed)) {
          return parsed.map(row => Array.isArray(row) ? row : [String(row)]);
        }
      } catch (_) {}
    }

    // Poging 3: CSV-achtige tekst → split op regels en kommas
    const lines = clean.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      return lines.map(line => {
        // Detecteer scheidingsteken: tab of komma
        const sep = line.includes('\t') ? '\t' : ',';
        return line.split(sep).map(cell => cell.trim().replace(/^"|"$/g, ''));
      });
    }

    // Fallback: één cel met de volledige tekst
    return [['Inhoud'], [clean]];
  }

  function exportExcel(messages) {
    if (typeof XLSX === 'undefined') {
      alert('SheetJS niet geladen. Controleer js/xlsx.full.min.js in je project.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Tabblad 1: Volledige chat als tabel
    const chatRows = [['Tijdstip', 'Rol', 'Inhoud']];
    messages.forEach(msg => {
      const time = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      const role = msg.role === 'user' ? 'Jij' : 'Claude';
      const text = stripMarkdown(getTextContent(msg.content));
      chatRows.push([time, role, text]);
    });
    const wsChat = XLSX.utils.aoa_to_sheet(chatRows);

    // Kolombreedtes instellen
    wsChat['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 80 }];

    // Header rij stijl (ondersteund via xlsx-stijl, simpele versie)
    XLSX.utils.book_append_sheet(wb, wsChat, 'Chat');

    // Tabblad 2: Als het laatste AI-antwoord tabeldata bevat, apart tabblad
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAiMsg) {
      const text = getTextContent(lastAiMsg.content);
      const tableData = parseToTableData(text);
      if (tableData.length > 1 || (tableData.length === 1 && tableData[0].length > 1)) {
        const wsData = XLSX.utils.aoa_to_sheet(tableData);
        // Automatische kolombreedtes
        const colWidths = tableData[0].map((_, ci) =>
          Math.min(50, Math.max(10, ...tableData.map(row => String(row[ci] || '').length)))
        );
        wsData['!cols'] = colWidths.map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, wsData, 'Data');
      }
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerDownload(
      new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      generateFilename('.xlsx')
    );
  }

  function exportSingleExcel(text) {
    if (typeof XLSX === 'undefined') {
      alert('SheetJS niet geladen. Controleer js/xlsx.full.min.js in je project.');
      return;
    }

    const wb       = XLSX.utils.book_new();
    const tableData = parseToTableData(text);
    const ws       = XLSX.utils.aoa_to_sheet(tableData);

    // Automatische kolombreedtes
    if (tableData[0]) {
      ws['!cols'] = tableData[0].map((_, ci) => ({
        wch: Math.min(60, Math.max(10, ...tableData.map(row => String(row[ci] || '').length)))
      }));
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Antwoord');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerDownload(
      new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      generateSingleFilename('.xlsx')
    );
  }

  // ─── DOCX builder ─────────────────────────────────────────────

  function escapeXml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&apos;');
  }

  function buildParagraph(text, style, bold, italic) {
    const pPr = `<w:pPr><w:pStyle w:val="${style || 'Normal'}"/></w:pPr>`;
    if (!text || !text.trim()) return `<w:p>${pPr}</w:p>`;
    let rPr = '';
    if (bold || italic) {
      rPr = '<w:rPr>' + (bold ? '<w:b/><w:bCs/>' : '') + (italic ? '<w:i/><w:iCs/>' : '') + '</w:rPr>';
    }
    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  }

  function buildDocumentXml(paragraphs) {
    const body = paragraphs.map(p => buildParagraph(p.text, p.style, p.bold, p.italic)).join('\n    ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

  const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;

  const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
</Relationships>`;

  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
    <w:sz w:val="24"/><w:szCs w:val="24"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
  </w:style>
</w:styles>`;

  async function buildDocxBlob(paragraphs) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip niet geladen. Controleer js/jszip.min.js in je project.');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.file('_rels/.rels',         ROOT_RELS);
    zip.file('word/document.xml',   buildDocumentXml(paragraphs));
    zip.file('word/styles.xml',     STYLES);
    zip.file('word/_rels/document.xml.rels', WORD_RELS);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  }

  function textToParagraphs(text) {
    return stripMarkdown(text).split('\n').filter(l => l.trim())
      .map(l => ({ text: l.trim(), style: 'Normal', bold: false, italic: false }));
  }

  // ─── Export: volledige chat ────────────────────────────────────

  function exportMarkdown(messages) {
    const lines = ['# Claude AI — Chat Export', '', `> Geëxporteerd: ${formatTimestamp(new Date().toISOString())}`, '', '---', ''];
    messages.forEach(msg => {
      const role = msg.role === 'user' ? '**Jij**' : '**Claude**';
      const time = msg.timestamp ? `*${formatTimestamp(msg.timestamp)}*` : '';
      lines.push(`### ${role} ${time}`, '', getTextContent(msg.content), '', '---', '');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), generateFilename('.md'));
  }

  function exportTxt(messages) {
    const lines = ['CLAUDE AI — CHAT EXPORT', '═'.repeat(50), `Geëxporteerd: ${formatTimestamp(new Date().toISOString())}`, '═'.repeat(50), ''];
    messages.forEach(msg => {
      const role = msg.role === 'user' ? 'JIJ' : 'CLAUDE';
      const time = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      lines.push(`[${role}] ${time}`, '─'.repeat(40), stripMarkdown(getTextContent(msg.content)), '');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), generateFilename('.txt'));
  }

  function exportHtml(messages) {
    const body = messages.map(msg => {
      const role      = msg.role === 'user' ? 'Jij' : 'Claude';
      const roleClass = msg.role === 'user' ? 'user' : 'ai';
      const time      = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      return `<div class="message message--${roleClass}">
        <div class="message-header"><span class="role">${role}</span><span class="time">${time}</span></div>
        <div class="content">${markdownToHtml(getTextContent(msg.content))}</div>
      </div>`;
    }).join('\n');
    triggerDownload(new Blob([buildHtmlWrapper('Claude AI — Chat Export', `Geëxporteerd: ${formatTimestamp(new Date().toISOString())} · ${messages.length} berichten`, body)], { type: 'text/html;charset=utf-8' }), generateFilename('.html'));
  }

  function exportJson(messages) {
    const data = {
      export: { timestamp: new Date().toISOString(), messageCount: messages.length },
      messages: messages.map(m => ({ role: m.role, content: getTextContent(m.content), timestamp: m.timestamp || null }))
    };
    triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), generateFilename('.json'));
  }

  function exportCsv(messages) {
    const rows = [['rol', 'inhoud', 'tijdstip']];
    messages.forEach(msg => {
      const clean = getTextContent(msg.content).replace(/"/g, '""').replace(/\n/g, ' ');
      rows.push([msg.role, `"${clean}"`, msg.timestamp ? formatTimestamp(msg.timestamp) : '']);
    });
    triggerDownload(new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), generateFilename('.csv'));
  }

  async function exportDocx(messages) {
    const paragraphs = [
      { text: 'Claude AI — Chat Export', style: 'Heading1', bold: true,  italic: false },
      { text: `Geëxporteerd: ${formatTimestamp(new Date().toISOString())}`, style: 'Normal', bold: false, italic: true },
      { text: '', style: 'Normal', bold: false, italic: false }
    ];
    messages.forEach(msg => {
      const role = msg.role === 'user' ? 'Jij' : 'Claude';
      const time = msg.timestamp ? ` — ${formatTimestamp(msg.timestamp)}` : '';
      paragraphs.push({ text: `${role}${time}`, style: 'Heading2', bold: true, italic: false });
      textToParagraphs(getTextContent(msg.content)).forEach(p => paragraphs.push(p));
      paragraphs.push({ text: '', style: 'Normal', bold: false, italic: false });
    });
    const blob = await buildDocxBlob(paragraphs);
    triggerDownload(blob, generateFilename('.docx'));
  }

  function exportPdf(messages) {
    const msgHtml = messages.map(msg => {
      const role      = msg.role === 'user' ? 'Jij' : 'Claude';
      const roleClass = msg.role === 'user' ? 'user' : 'ai';
      const time      = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      const plain     = stripMarkdown(getTextContent(msg.content));
      return `<div class="msg msg--${roleClass}">
        <div class="msg-head"><strong>${role}</strong><span>${time}</span></div>
        <div class="msg-body">${plain.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('')}</div>
      </div>`;
    }).join('');
    openPrintWindow('Claude AI — Chat Export', `Geëxporteerd: ${formatTimestamp(new Date().toISOString())} · ${messages.length} berichten`, msgHtml);
  }

  // ─── Export: enkel antwoord ───────────────────────────────────

  async function exportSingleMessage(text, format) {
    switch (format) {
      case 'docx': {
        const paragraphs = [
          { text: 'Claude — Antwoord', style: 'Heading1', bold: true, italic: false },
          { text: formatTimestamp(new Date().toISOString()), style: 'Normal', bold: false, italic: true },
          { text: '', style: 'Normal', bold: false, italic: false },
          ...textToParagraphs(text)
        ];
        triggerDownload(await buildDocxBlob(paragraphs), generateSingleFilename('.docx'));
        break;
      }
      case 'excel': {
        exportSingleExcel(text);
        break;
      }
      case 'pdf': {
        const plain = stripMarkdown(text);
        const body  = plain.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');
        openPrintWindow('Claude — Antwoord', formatTimestamp(new Date().toISOString()), `<div class="msg msg--ai"><div class="msg-body">${body}</div></div>`);
        break;
      }
      case 'html': {
        const body = `<div class="message message--ai">
          <div class="message-header"><span class="role">Claude</span><span class="time">${formatTimestamp(new Date().toISOString())}</span></div>
          <div class="content">${markdownToHtml(text)}</div>
        </div>`;
        triggerDownload(new Blob([buildHtmlWrapper('Claude — Antwoord', formatTimestamp(new Date().toISOString()), body)], { type: 'text/html;charset=utf-8' }), generateSingleFilename('.html'));
        break;
      }
      case 'markdown': {
        triggerDownload(new Blob([`# Claude — Antwoord\n\n> ${formatTimestamp(new Date().toISOString())}\n\n---\n\n${text}`], { type: 'text/markdown;charset=utf-8' }), generateSingleFilename('.md'));
        break;
      }
      case 'txt':
      default: {
        triggerDownload(new Blob([`CLAUDE — ANTWOORD\n${'═'.repeat(50)}\n${formatTimestamp(new Date().toISOString())}\n${'═'.repeat(50)}\n\n${stripMarkdown(text)}`], { type: 'text/plain;charset=utf-8' }), generateSingleFilename('.txt'));
        break;
      }
    }
  }

  // ─── Gedeelde helpers ─────────────────────────────────────────

  function openPrintWindow(title, meta, bodyHtml) {
    const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>${title}</title>
<style>
  @page { margin: 20mm; size: A4; }
  body { font-family: 'Segoe UI', sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 18pt; margin-bottom: 4pt; }
  .meta { font-size: 9pt; color: #666; margin-bottom: 20pt; border-bottom: 1pt solid #ddd; padding-bottom: 8pt; }
  .msg { margin-bottom: 14pt; border: 1pt solid #ddd; border-radius: 4pt; overflow: hidden; page-break-inside: avoid; }
  .msg-head { display: flex; justify-content: space-between; padding: 6pt 10pt; background: #f0ede8; font-size: 9pt; }
  .msg--ai .msg-head { background: #1a1a1a; color: #fff; }
  .msg--ai .msg-head span { color: #999; }
  .msg-body { padding: 10pt; font-size: 10.5pt; }
  .msg-body p { margin: 0 0 6pt; } .msg-body p:last-child { margin: 0; }
</style></head><body>
<h1>◆ ${title}</h1><div class="meta">${meta}</div>${bodyHtml}
</body></html>`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Sta pop-ups toe om PDF te kunnen exporteren.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }

  function buildHtmlWrapper(title, meta, bodyHtml) {
    return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8f7f5; color: #1a1a1a; line-height: 1.7; padding: 40px 20px; }
  .container { max-width: 800px; margin: 0 auto; }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 32px; }
  header h1 { font-size: 22px; font-weight: 700; } header .meta { font-size: 13px; color: #666; margin-top: 4px; }
  .message { margin-bottom: 20px; border-radius: 10px; overflow: hidden; border: 1px solid #e0ddd8; }
  .message-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: #f0ede8; border-bottom: 1px solid #e0ddd8; }
  .message--ai .message-header { background: #1a1a1a; color: #f0f0f0; }
  .role { font-weight: 700; font-size: 13px; } .time { font-size: 11px; color: #888; font-family: monospace; }
  .content { padding: 16px; background: #fff; font-size: 14px; } .message--ai .content { background: #fafaf9; }
  .content p { margin-bottom: 10px; } .content p:last-child { margin-bottom: 0; }
  .content h1, .content h2, .content h3 { font-weight: 700; margin: 16px 0 8px; }
  .content h1 { font-size: 20px; } .content h2 { font-size: 17px; } .content h3 { font-size: 15px; }
  .content ul, .content ol { padding-left: 20px; margin: 8px 0; } .content li { margin-bottom: 4px; }
  .content code { background: #f0ede8; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
  .content pre { background: #f0ede8; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 10px 0; }
  .content blockquote { border-left: 3px solid #c0b080; padding: 6px 14px; color: #555; margin: 10px 0; }
  .content table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  .content th { background: #f0ede8; border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 12px; }
  .content td { border: 1px solid #ddd; padding: 8px 12px; }
  footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #e0ddd8; padding-top: 16px; }
</style></head><body>
<div class="container">
  <header><h1>◆ ${title}</h1><div class="meta">${meta}</div></header>
  ${bodyHtml}
  <footer>Gegenereerd via Claude AI Persoonlijke Interface</footer>
</div></body></html>`;
  }

  // ─── Publieke API ──────────────────────────────────────────────

  async function exportChat(messages, format) {
    if (!messages || messages.length === 0) { alert('Er zijn geen berichten om te exporteren.'); return; }
    switch (format) {
      case 'markdown': exportMarkdown(messages);       break;
      case 'txt':      exportTxt(messages);            break;
      case 'html':     exportHtml(messages);           break;
      case 'json':     exportJson(messages);           break;
      case 'csv':      exportCsv(messages);            break;
      case 'pdf':      exportPdf(messages);            break;
      case 'excel':    exportExcel(messages);          break;
      case 'docx':     await exportDocx(messages);    break;
      default:         exportMarkdown(messages);
    }
  }

  return { exportChat, exportSingleMessage };

})();
