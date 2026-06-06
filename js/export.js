/**
 * EXPORT.JS
 * Chat exporteren naar verschillende bestandsformaten
 */

const Exporter = (() => {

  // ─── Hulpfuncties ───────────────────────────────────────────

  function formatTimestamp(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString('nl-NL', {
      dateStyle: 'long',
      timeStyle: 'short'
    });
  }

  function sanitizeFilename(str) {
    return str.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 40);
  }

  function generateFilename(format) {
    const now = new Date();
    const stamp = now.toISOString().slice(0,10);
    return `claude-chat_${stamp}${format}`;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
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
      .replace(/>\s?(.*)/gm, '$1')
      .replace(/---+/g, '─'.repeat(40))
      .trim();
  }

  // ─── Markdown renderer (simpel) ─────────────────────────────
  function markdownToHtml(text) {
    let html = text
      // Headings
      .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
      .replace(/^####\s(.+)$/gm, '<h4>$1</h4>')
      .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
      // Bold & italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Code blocks
      .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Blockquote
      .replace(/^>\s(.+)$/gm, '<blockquote>$1</blockquote>')
      // HR
      .replace(/^---+$/gm, '<hr>')
      // Lists
      .replace(/^\s*[-*+]\s(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      // Numbered lists
      .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Paragraphs
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }

  // ─── Export functies ─────────────────────────────────────────

  function exportMarkdown(messages) {
    const lines = [
      '# Claude AI — Chat Export',
      '',
      `> Geëxporteerd op: ${formatTimestamp(new Date().toISOString())}`,
      '',
      '---',
      ''
    ];

    messages.forEach(msg => {
      const role = msg.role === 'user' ? '**Jij**' : '**Claude**';
      const time = msg.timestamp ? `*${formatTimestamp(msg.timestamp)}*` : '';
      lines.push(`### ${role} ${time}`);
      lines.push('');

      const textContent = Array.isArray(msg.content)
        ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
        : (typeof msg.content === 'string' ? msg.content : '');

      lines.push(textContent);
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    triggerDownload(blob, generateFilename('.md'));
  }

  function exportTxt(messages) {
    const lines = [
      'CLAUDE AI — CHAT EXPORT',
      '═'.repeat(50),
      `Geëxporteerd: ${formatTimestamp(new Date().toISOString())}`,
      '═'.repeat(50),
      ''
    ];

    messages.forEach((msg, i) => {
      const role = msg.role === 'user' ? 'JIJ' : 'CLAUDE';
      const time = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      lines.push(`[${role}] ${time}`);
      lines.push('─'.repeat(40));

      const textContent = Array.isArray(msg.content)
        ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
        : (typeof msg.content === 'string' ? msg.content : '');

      lines.push(stripMarkdown(textContent));
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, generateFilename('.txt'));
  }

  function exportHtml(messages) {
    const msgHtml = messages.map(msg => {
      const role = msg.role === 'user' ? 'Jij' : 'Claude';
      const roleClass = msg.role === 'user' ? 'user' : 'ai';
      const time = msg.timestamp ? formatTimestamp(msg.timestamp) : '';

      const textContent = Array.isArray(msg.content)
        ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
        : (typeof msg.content === 'string' ? msg.content : '');

      const contentHtml = markdownToHtml(textContent);

      return `
      <div class="message message--${roleClass}">
        <div class="message-header">
          <span class="role">${role}</span>
          <span class="time">${time}</span>
        </div>
        <div class="content">${contentHtml}</div>
      </div>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude AI — Chat Export</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8f7f5; color: #1a1a1a; line-height: 1.7; padding: 40px 20px; }
  .container { max-width: 800px; margin: 0 auto; }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 32px; }
  header h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  header .meta { font-size: 13px; color: #666; margin-top: 4px; }
  .message { margin-bottom: 20px; border-radius: 10px; overflow: hidden; border: 1px solid #e0ddd8; }
  .message-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: #f0ede8; border-bottom: 1px solid #e0ddd8; }
  .message--ai .message-header { background: #1a1a1a; color: #f0f0f0; }
  .message--ai .time { color: #888; }
  .role { font-weight: 700; font-size: 13px; }
  .time { font-size: 11px; color: #888; font-family: monospace; }
  .content { padding: 16px; background: #fff; }
  .message--ai .content { background: #fafaf9; }
  .content p { margin-bottom: 10px; font-size: 14px; }
  .content p:last-child { margin-bottom: 0; }
  .content h1, .content h2, .content h3 { font-weight: 700; margin: 16px 0 8px; }
  .content h1 { font-size: 20px; }
  .content h2 { font-size: 17px; }
  .content h3 { font-size: 15px; }
  .content ul, .content ol { padding-left: 20px; margin: 8px 0; }
  .content li { margin-bottom: 4px; font-size: 14px; }
  .content code { background: #f0ede8; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; }
  .content pre { background: #f0ede8; border-radius: 6px; padding: 14px; overflow-x: auto; margin: 10px 0; }
  .content pre code { background: none; padding: 0; }
  .content table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  .content th { background: #f0ede8; border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
  .content td { border: 1px solid #ddd; padding: 8px 12px; font-size: 14px; }
  .content blockquote { border-left: 3px solid #c0b080; padding: 6px 14px; color: #555; margin: 10px 0; }
  footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #e0ddd8; padding-top: 16px; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>◆ Claude AI — Chat Export</h1>
    <div class="meta">Geëxporteerd op ${formatTimestamp(new Date().toISOString())} · ${messages.length} berichten</div>
  </header>
  <div class="messages">
    ${msgHtml}
  </div>
  <footer>Gegenereerd via Claude AI Persoonlijke Interface</footer>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    triggerDownload(blob, generateFilename('.html'));
  }

  function exportJson(messages) {
    const data = {
      export: {
        timestamp: new Date().toISOString(),
        messageCount: messages.length
      },
      messages: messages.map(msg => {
        const textContent = Array.isArray(msg.content)
          ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
          : (typeof msg.content === 'string' ? msg.content : '');
        return {
          role: msg.role,
          content: textContent,
          timestamp: msg.timestamp || null
        };
      })
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerDownload(blob, generateFilename('.json'));
  }

  function exportCsv(messages) {
    const rows = [
      ['rol', 'inhoud', 'tijdstip']
    ];

    messages.forEach(msg => {
      const textContent = Array.isArray(msg.content)
        ? msg.content.filter(c => c.type === 'text').map(c => c.text).join(' ')
        : (typeof msg.content === 'string' ? msg.content : '');

      const clean = textContent.replace(/"/g, '""').replace(/\n/g, ' ');
      rows.push([
        msg.role,
        `"${clean}"`,
        msg.timestamp ? formatTimestamp(msg.timestamp) : ''
      ]);
    });

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, generateFilename('.csv'));
  }

  /**
   * Word (.docx) export — genereert een eenvoudig .docx via XML
   * Werkt zonder externe libraries
   */
  function exportDocx(messages) {
    // Bouw de document XML op
    const paragraphs = [];

    // Titel
    paragraphs.push(makeParagraph('Claude AI — Chat Export', 'Heading1'));
    paragraphs.push(makeParagraph(`Geëxporteerd: ${formatTimestamp(new Date().toISOString())}`, 'Normal', true));
    paragraphs.push(makeParagraph(''));

    messages.forEach(msg => {
      const role = msg.role === 'user' ? 'Jij' : 'Claude';
      const time = msg.timestamp ? ` — ${formatTimestamp(msg.timestamp)}` : '';

      paragraphs.push(makeParagraph(`${role}${time}`, 'Heading2'));

      const textContent = Array.isArray(msg.content)
        ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
        : (typeof msg.content === 'string' ? msg.content : '');

      const plain = stripMarkdown(textContent);
      const lines = plain.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          paragraphs.push(makeParagraph(line.trim()));
        }
      });

      paragraphs.push(makeParagraph(''));
    });

    const docXml = buildDocxXml(paragraphs);
    const docxBlob = createDocxBlob(docXml);
    triggerDownload(docxBlob, generateFilename('.docx'));
  }

  function makeParagraph(text, style = 'Normal', italic = false) {
    return { text, style, italic };
  }

  function escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function buildDocxXml(paragraphs) {
    const pXml = paragraphs.map(p => {
      const styleXml = `<w:pStyle w:val="${p.style || 'Normal'}"/>`;
      const rProps = p.italic ? '<w:rPr><w:i/><w:color w:val="666666"/></w:rPr>' : '';
      const textXml = p.text ? `<w:r>${rProps}<w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r>` : '';
      return `<w:p><w:pPr><${styleXml}</w:pPr>${textXml}</w:p>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${pXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

  function createDocxBlob(documentXml) {
    // Minimale .docx structuur
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>
    <w:pPr><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
</w:styles>`;

    // Gebruik JSZip als beschikbaar, anders fallback naar tekstdownload
    if (typeof JSZip !== 'undefined') {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', contentTypes);
      zip.file('_rels/.rels', rels);
      zip.file('word/document.xml', documentXml);
      zip.file('word/styles.xml', styles);
      zip.file('word/_rels/document.xml.rels', wordRels);

      return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    } else {
      // Fallback: export als .txt als JSZip niet beschikbaar is
      console.warn('JSZip niet geladen, exporteren als .txt');
      return Promise.resolve(new Blob([documentXml], { type: 'text/plain;charset=utf-8' }));
    }
  }

  /**
   * PDF export via browser print / window.print
   * Opent een print-venster met gestylede HTML
   */
  function exportPdf(messages) {
    const msgHtml = messages.map(msg => {
      const role = msg.role === 'user' ? 'Jij' : 'Claude';
      const roleClass = msg.role === 'user' ? 'user' : 'ai';
      const time = msg.timestamp ? formatTimestamp(msg.timestamp) : '';

      const textContent = Array.isArray(msg.content)
        ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
        : (typeof msg.content === 'string' ? msg.content : '');

      const plain = stripMarkdown(textContent);

      return `
      <div class="msg msg--${roleClass}">
        <div class="msg-head"><strong>${role}</strong><span>${time}</span></div>
        <div class="msg-body">${plain.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('')}</div>
      </div>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Claude AI — Chat Export</title>
<style>
  @page { margin: 20mm; size: A4; }
  body { font-family: 'Segoe UI', sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 18pt; margin-bottom: 4pt; }
  .meta { font-size: 9pt; color: #666; margin-bottom: 20pt; }
  .msg { margin-bottom: 14pt; border: 1pt solid #ddd; border-radius: 4pt; overflow: hidden; page-break-inside: avoid; }
  .msg-head { display: flex; justify-content: space-between; padding: 6pt 10pt; background: #f0ede8; font-size: 9pt; }
  .msg-head strong { font-weight: 700; }
  .msg-head span { color: #888; }
  .msg--ai .msg-head { background: #1a1a1a; color: #fff; }
  .msg--ai .msg-head span { color: #999; }
  .msg-body { padding: 10pt; font-size: 10.5pt; }
  .msg-body p { margin: 0 0 6pt; }
  .msg-body p:last-child { margin: 0; }
</style>
</head>
<body>
<h1>◆ Claude AI — Chat Export</h1>
<div class="meta">Geëxporteerd: ${formatTimestamp(new Date().toISOString())} · ${messages.length} berichten</div>
${msgHtml}
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Blokkeer geen pop-ups om PDF te kunnen exporteren.');
      return;
    }
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  // ─── Publieke API ─────────────────────────────────────────────

  async function exportChat(messages, format) {
    if (!messages || messages.length === 0) {
      alert('Er zijn geen berichten om te exporteren.');
      return;
    }

    switch (format) {
      case 'markdown': exportMarkdown(messages); break;
      case 'txt': exportTxt(messages); break;
      case 'html': exportHtml(messages); break;
      case 'json': exportJson(messages); break;
      case 'csv': exportCsv(messages); break;
      case 'pdf': exportPdf(messages); break;
      case 'docx': {
        const result = createDocxBlob(buildDocxXml(
          (() => {
            const ps = [];
            ps.push(makeParagraph('Claude AI — Chat Export', 'Heading1'));
            ps.push(makeParagraph(`Geëxporteerd: ${formatTimestamp(new Date().toISOString())}`, 'Normal', true));
            ps.push(makeParagraph(''));
            messages.forEach(msg => {
              const role = msg.role === 'user' ? 'Jij' : 'Claude';
              const time = msg.timestamp ? ` — ${formatTimestamp(msg.timestamp)}` : '';
              ps.push(makeParagraph(`${role}${time}`, 'Heading2'));
              const tc = Array.isArray(msg.content)
                ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
                : (typeof msg.content === 'string' ? msg.content : '');
              stripMarkdown(tc).split('\n').filter(l => l.trim()).forEach(l => ps.push(makeParagraph(l)));
              ps.push(makeParagraph(''));
            });
            return ps;
          })()
        ));
        if (result && typeof result.then === 'function') {
          result.then(blob => triggerDownload(blob, generateFilename('.docx')));
        } else {
          triggerDownload(result, generateFilename('.docx'));
        }
        break;
      }
      default:
        exportMarkdown(messages);
    }
  }

  return { exportChat };
})();
