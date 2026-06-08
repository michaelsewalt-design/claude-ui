/**
 * UI.JS — v5
 * DOM rendering, componenten en visuele interacties.
 * Nieuw: PowerPoint toegevoegd aan download-menu en export modal
 */

const UI = (() => {

  // ─── Markdown renderer ────────────────────────────────────────
  function renderMarkdown(text) {
    let html = text
      .replace(/```([\w]*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<pre><code class="lang-' + lang + '">' + escaped + '</code></pre>';
      })
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/^#{6}\s(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#{5}\s(.+)$/gm, '<h5>$1</h5>')
      .replace(/^#{4}\s(.+)$/gm, '<h4>$1</h4>')
      .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
      .replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>')
      .replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,        '<em>$1</em>')
      .replace(/^>\s(.+)$/gm,       '<blockquote>$1</blockquote>')
      .replace(/^---+$/gm,          '<hr>')
      .replace(/^\s*[-*+]\s(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>')
      .replace(/^\d+\.\s(.+)$/gm,   '<li>$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n\n+/g, '\n\n');

    return text.split('\n\n').map(part => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|table|tr)/.test(trimmed)) return trimmed;
      return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
    }).filter(Boolean).join('\n');
  }

  // ─── Modellen renderen ────────────────────────────────────────
  function renderModels(currentModelId, onSelect) {
    const dropdown = document.getElementById('modelDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = MODELS.map(m =>
      '<div class="model-option ' + (m.id === currentModelId ? 'active' : '') + '" data-id="' + m.id + '">' +
        '<div class="model-option-head">' +
          '<span class="model-option-name">' + m.name + '</span>' +
          '<span class="model-option-tag tag--' + m.tag + '">' + m.tagLabel + '</span>' +
        '</div>' +
        '<div class="model-option-desc">' + m.description + '</div>' +
      '</div>'
    ).join('');
    dropdown.querySelectorAll('.model-option').forEach(el => {
      el.addEventListener('click', () => {
        onSelect(el.dataset.id);
        document.getElementById('modelSelectorWrapper').classList.remove('open');
      });
    });
  }

  function setCurrentModel(model) {
    const nameEl   = document.getElementById('modelCurrentName');
    const topbarEl = document.getElementById('topbarModelName');
    if (nameEl)   nameEl.textContent   = model.name;
    if (topbarEl) topbarEl.textContent = model.name;
    document.querySelectorAll('.model-option').forEach(el => {
      el.classList.toggle('active', el.dataset.id === model.id);
    });
  }

  // ─── Formaten renderen ────────────────────────────────────────
  function renderFormats(currentFormatId, onSelect) {
    const grid = document.getElementById('formatGrid');
    if (!grid) return;
    const noneCat = OUTPUT_FORMATS.find(f => f.id === 'none');
    const rest    = OUTPUT_FORMATS.filter(f => f.id !== 'none');
    grid.innerHTML = [noneCat, ...rest].map(f =>
      '<button class="format-btn ' + (f.id === currentFormatId ? 'active' : '') + '" data-id="' + f.id + '" title="' + f.label + '">' +
        f.icon +
        '<span>' + f.label + '</span>' +
      '</button>'
    ).join('');
    grid.querySelectorAll('.format-btn').forEach(el => {
      el.addEventListener('click', () => onSelect(el.dataset.id));
    });
  }

  function setCurrentFormat(format) {
    document.querySelectorAll('.format-btn').forEach(el => {
      el.classList.toggle('active', el.dataset.id === format.id);
    });
    const badge            = document.getElementById('formatBadge');
    const topbarFormatName = document.getElementById('topbarFormatName');
    if (format.id === 'none') {
      if (badge) badge.style.display = 'none';
      if (topbarFormatName) topbarFormatName.textContent = 'Geen';
    } else {
      if (badge) { badge.style.display = 'inline-block'; badge.textContent = format.label; }
      if (topbarFormatName) topbarFormatName.textContent = format.label;
    }
  }

  // ─── Berichten renderen ───────────────────────────────────────
  function renderMessage(role, contentText, format, timestamp) {
    const messagesEl = document.getElementById('messages');
    const welcome    = document.getElementById('welcomeScreen');
    if (!messagesEl) return;
    if (welcome) welcome.style.display = 'none';

    const div         = document.createElement('div');
    div.className     = 'message message--' + role;
    const time        = timestamp
      ? new Date(timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
      : '';
    const roleLabel   = role === 'user' ? 'Jij' : 'Claude';
    const avatarLabel = role === 'user' ? 'U' : '\u25C6';
    const htmlContent = role === 'assistant'
      ? renderMarkdown(contentText)
      : '<p>' + escapeHtml(contentText).replace(/\n/g, '<br>') + '</p>';

    const formatTag = (format && format.id !== 'none')
      ? '<span class="format-tag">' + format.label + '</span>'
      : '';

    // Download-menu opties — inclusief PowerPoint
    const downloadMenu = role === 'assistant'
      ? '<div class="msg-download-wrap">' +
          '<button class="msg-download-toggle" title="Downloaden als...">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>' +
              '<polyline points="7 10 12 15 17 10"/>' +
              '<line x1="12" y1="15" x2="12" y2="3"/>' +
            '</svg>' +
            'Downloaden' +
            '<svg class="chevron-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<polyline points="6 9 12 15 18 9"/>' +
            '</svg>' +
          '</button>' +
          '<div class="msg-download-menu" style="display:none">' +
            '<button class="msg-dl-opt" data-fmt="docx">Word (.docx)</button>' +
            '<button class="msg-dl-opt" data-fmt="powerpoint">PowerPoint (.pptx)</button>' +
            '<button class="msg-dl-opt" data-fmt="excel">Excel (.xlsx)</button>' +
            '<button class="msg-dl-opt" data-fmt="pdf">PDF</button>' +
            '<button class="msg-dl-opt" data-fmt="html">HTML</button>' +
            '<button class="msg-dl-opt" data-fmt="markdown">Markdown</button>' +
            '<button class="msg-dl-opt" data-fmt="txt">Platte tekst</button>' +
          '</div>' +
        '</div>'
      : '';

    const copyBtnHtml = role === 'assistant'
      ? '<button class="copy-btn" data-text="' + escapeAttr(contentText) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
            '<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>' +
          '</svg>' +
          'Kopi\u00ebren' +
        '</button>'
      : '';

    div.innerHTML =
      '<div class="message-avatar">' + avatarLabel + '</div>' +
      '<div class="message-content">' +
        '<div class="message-role">' + roleLabel + '</div>' +
        '<div class="message-text">' + htmlContent + '</div>' +
        '<div class="message-meta">' +
          '<span class="message-time">' + time + '</span>' +
          formatTag +
          copyBtnHtml +
        '</div>' +
        downloadMenu +
      '</div>';

    // Kopieer-knop
    const copyBtn = div.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(copyBtn.dataset.text).then(() => {
          copyBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' +
            'Gekopieerd';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
              '<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
              'Kopi\u00ebren';
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });
    }

    // Download-toggle
    const dlToggle = div.querySelector('.msg-download-toggle');
    const dlMenu   = div.querySelector('.msg-download-menu');
    if (dlToggle && dlMenu) {
      dlToggle.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = dlMenu.style.display !== 'none';
        document.querySelectorAll('.msg-download-menu').forEach(m => { m.style.display = 'none'; });
        document.querySelectorAll('.msg-download-toggle').forEach(b => { b.classList.remove('active'); });
        if (!isOpen) {
          dlMenu.style.display = 'block';
          dlToggle.classList.add('active');
        }
      });

      const dlLabels = {
        docx:        'Word (.docx)',
        powerpoint:  'PowerPoint (.pptx)',
        excel:       'Excel (.xlsx)',
        pdf:         'PDF',
        html:        'HTML',
        markdown:    'Markdown',
        txt:         'Platte tekst'
      };

      dlMenu.querySelectorAll('.msg-dl-opt').forEach(btn => {
        btn.addEventListener('click', async () => {
          const fmt = btn.dataset.fmt;
          dlMenu.style.display = 'none';
          dlToggle.classList.remove('active');
          btn.textContent = 'Bezig...';
          try {
            await Exporter.exportSingleMessage(contentText, fmt);
          } catch (err) {
            alert('Download mislukt: ' + err.message);
          }
          setTimeout(() => {
            btn.textContent = dlLabels[fmt] || fmt;
          }, 1500);
        });
      });
    }

    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  // ─── Typing indicator ─────────────────────────────────────────
  function showTyping() {
    const messagesEl = document.getElementById('messages');
    const welcome    = document.getElementById('welcomeScreen');
    if (!messagesEl) return null;
    if (welcome) welcome.style.display = 'none';
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typingIndicator';
    el.innerHTML =
      '<div class="message-avatar" style="width:28px;height:28px;border-radius:50%;background:var(--accent-dim);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;">\u25C6</div>' +
      '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>' +
      '<span class="typing-label">Claude denkt na\u2026</span>';
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  // ─── Foutmelding ──────────────────────────────────────────────
  function showError(text) {
    const chatArea = document.getElementById('chatArea');
    chatArea.querySelectorAll('.error-message').forEach(e => e.remove());
    const el = document.createElement('div');
    el.className = 'error-message';
    el.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>' +
      '<line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>' + text + '</span>';
    chatArea.appendChild(el);
    scrollToBottom();
  }

  function clearMessages() {
    const messagesEl = document.getElementById('messages');
    const welcome    = document.getElementById('welcomeScreen');
    if (messagesEl) messagesEl.innerHTML = '';
    if (welcome) welcome.style.display = 'flex';
  }

  function scrollToBottom() {
    const chatArea = document.getElementById('chatArea');
    if (chatArea) requestAnimationFrame(() => { chatArea.scrollTop = chatArea.scrollHeight; });
  }

  // ─── Bestandslijst ────────────────────────────────────────────
  function renderFileList(files, onRemove) {
    const list = document.getElementById('fileList');
    if (!list) return;
    list.innerHTML = files.map((f, i) =>
      '<div class="file-item" data-index="' + i + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '<span class="file-item-name" title="' + f.name + '">' + f.name + '</span>' +
        '<span style="font-family:var(--font-mono);font-size:10px;color:var(--text-3);margin-left:auto;flex-shrink:0;">' + formatBytes(f.size) + '</span>' +
        '<button class="file-remove" data-index="' + i + '" title="Verwijderen">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>'
    ).join('');
    list.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.index)));
    });
  }

  function renderAttachmentChips(files, onRemove) {
    const container = document.getElementById('inputAttachments');
    if (!container) return;
    if (files.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = files.map((f, i) =>
      '<div class="attach-chip">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>' +
        '<span>' + f.name + '</span>' +
        '<button class="attach-remove" data-index="' + i + '" title="Verwijderen">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>'
    ).join('');
    container.querySelectorAll('.attach-remove').forEach(btn => {
      btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.index)));
    });
  }

  // ─── Statistieken ─────────────────────────────────────────────
  function updateStats(messageCount, estimatedTokens) {
    const msgEl = document.getElementById('statMessages');
    const tokEl = document.getElementById('statTokens');
    if (msgEl) msgEl.textContent = messageCount;
    if (tokEl) tokEl.textContent = '~' + estimatedTokens.toLocaleString('nl-NL');
  }

  // ─── Export modal formaten ────────────────────────────────────
  function renderExportFormats(currentFormat) {
    const container = document.getElementById('exportFormats');
    if (!container) return;

    const formats = [
      { id: 'docx',        label: 'Word',        ext: '.docx' },
      { id: 'powerpoint',  label: 'PowerPoint',  ext: '.pptx' },
      { id: 'excel',       label: 'Excel',       ext: '.xlsx' },
      { id: 'pdf',         label: 'PDF',         ext: '.pdf'  },
      { id: 'html',        label: 'HTML',        ext: '.html' },
      { id: 'markdown',    label: 'Markdown',    ext: '.md'   },
      { id: 'txt',         label: 'Tekst',       ext: '.txt'  },
      { id: 'json',        label: 'JSON',        ext: '.json' },
      { id: 'csv',         label: 'CSV',         ext: '.csv'  }
    ];

    container.innerHTML = formats.map(f =>
      '<button class="export-format-btn ' + (f.id === (currentFormat || 'docx') ? 'active' : '') + '" data-id="' + f.id + '">' +
        '<span class="ext">' + f.ext + '</span>' +
        '<span>' + f.label + '</span>' +
      '</button>'
    ).join('');

    let selected = currentFormat || 'docx';
    container.dataset.selected = selected;

    container.querySelectorAll('.export-format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selected = btn.dataset.id;
        container.querySelectorAll('.export-format-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.id === selected);
        });
        container.dataset.selected = selected;
      });
    });
  }

  // ─── Hulpfuncties ─────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/\n/g, '&#10;');
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }


  // ─── Continuation indicator ───────────────────────────────────
  /**
   * Toont een "Continuing response…" indicator terwijl er
   * een vervolg-API-call loopt na max_tokens afkapping.
   * Vervangt de normale typing indicator.
   */
  function showContinuing(partialText) {
    // Verberg gewone typing indicator als die er nog is
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();

    // Maak/update de continuing indicator
    let el = document.getElementById('continuingIndicator');
    if (!el) {
      const messagesEl = document.getElementById('messages');
      if (!messagesEl) return;
      el = document.createElement('div');
      el.id = 'continuingIndicator';
      el.className = 'continuing-indicator';
      el.innerHTML =
        '<div class="continuing-inner">' +
          '<div class="continuing-dots">' +
            '<div class="typing-dot"></div>' +
            '<div class="typing-dot"></div>' +
            '<div class="typing-dot"></div>' +
          '</div>' +
          '<span class="continuing-label">Continuing response…</span>' +
          '<span class="continuing-count" id="continuingCount"></span>' +
        '</div>';
      messagesEl.appendChild(el);
    }

    // Tel het aantal vervolgvragen op basis van hoeveel keer we hier komen
    const countEl = document.getElementById('continuingCount');
    if (countEl) {
      const current = parseInt(countEl.dataset.count || '0') + 1;
      countEl.dataset.count = current;
      countEl.textContent = 'Part ' + current;
    }

    scrollToBottom();
  }

  function hideContinuing() {
    const el = document.getElementById('continuingIndicator');
    if (el) el.remove();
    // Reset teller
    const countEl = document.getElementById('continuingCount');
    if (countEl) countEl.dataset.count = '0';
  }

  return {
    renderMarkdown,
    renderModels,
    setCurrentModel,
    renderFormats,
    setCurrentFormat,
    renderMessage,
    showTyping,
    hideTyping,
    showError,
    clearMessages,
    scrollToBottom,
    renderFileList,
    renderAttachmentChips,
    updateStats,
    renderExportFormats,
    escapeHtml,
    formatBytes,
    showContinuing,
    hideContinuing
  };

})();