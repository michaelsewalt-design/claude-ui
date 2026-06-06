/**
 * UI.JS
 * DOM rendering, componenten en visuele interacties
 */

const UI = (() => {

  // ─── Markdown renderer ────────────────────────────────────────
  function renderMarkdown(text) {
    let html = text
      // Code blocks (voor andere processing)
      .replace(/```([\w]*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class="lang-${lang}">${escaped}</code></pre>`;
      })
      // Inline code
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      // Headings
      .replace(/^#{6}\s(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#{5}\s(.+)$/gm, '<h5>$1</h5>')
      .replace(/^#{4}\s(.+)$/gm, '<h4>$1</h4>')
      .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
      // Bold + italic
      .replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>')
      .replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Blockquote
      .replace(/^>\s(.+)$/gm, '<blockquote>$1</blockquote>')
      // HR
      .replace(/^---+$/gm, '<hr>')
      // Tables
      .replace(/^\|(.+)\|$/gm, (match) => {
        if (match.includes('---')) return '';
        const cells = match.slice(1, -1).split('|').map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      })
      // Unordered lists
      .replace(/(^[-*+]\s.+\n?)+/gm, match => {
        const items = match.trim().split('\n')
          .filter(l => l.trim())
          .map(l => `<li>${l.replace(/^[-*+]\s/, '')}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      })
      // Ordered lists
      .replace(/(^\d+\.\s.+\n?)+/gm, match => {
        const items = match.trim().split('\n')
          .filter(l => l.trim())
          .map(l => `<li>${l.replace(/^\d+\.\s/, '')}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      })
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      // Paragraphs
      .replace(/\n\n+/g, '\n\n');

    // Wrap in paragraphs
    const parts = html.split('\n\n');
    const wrapped = parts.map(part => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|table|tr)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    });

    return wrapped.filter(Boolean).join('\n');
  }

  // ─── Modellen renderen ────────────────────────────────────────
  function renderModels(currentModelId, onSelect) {
    const dropdown = document.getElementById('modelDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = MODELS.map(m => `
      <div class="model-option ${m.id === currentModelId ? 'active' : ''}" data-id="${m.id}">
        <div class="model-option-head">
          <span class="model-option-name">${m.name}</span>
          <span class="model-option-tag tag--${m.tag}">${m.tagLabel}</span>
        </div>
        <div class="model-option-desc">${m.description}</div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.model-option').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        onSelect(id);
        document.getElementById('modelSelectorWrapper').classList.remove('open');
      });
    });
  }

  function setCurrentModel(model) {
    const nameEl = document.getElementById('modelCurrentName');
    const topbarEl = document.getElementById('topbarModelName');
    if (nameEl) nameEl.textContent = model.name;
    if (topbarEl) topbarEl.textContent = model.name;

    // Update active state
    document.querySelectorAll('.model-option').forEach(el => {
      el.classList.toggle('active', el.dataset.id === model.id);
    });
  }

  // ─── Formaten renderen ────────────────────────────────────────
  function renderFormats(currentFormatId, onSelect) {
    const grid = document.getElementById('formatGrid');
    if (!grid) return;

    const noneCat = OUTPUT_FORMATS.find(f => f.id === 'none');
    const rest = OUTPUT_FORMATS.filter(f => f.id !== 'none');

    const renderBtn = f => `
      <button class="format-btn ${f.id === currentFormatId ? 'active' : ''}" data-id="${f.id}" title="${f.label}">
        ${f.icon}
        <span>${f.label}</span>
      </button>
    `;

    grid.innerHTML = [noneCat, ...rest].map(renderBtn).join('');

    grid.querySelectorAll('.format-btn').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        onSelect(id);
      });
    });
  }

  function setCurrentFormat(format) {
    document.querySelectorAll('.format-btn').forEach(el => {
      el.classList.toggle('active', el.dataset.id === format.id);
    });

    const badge = document.getElementById('formatBadge');
    const topbarFormatName = document.getElementById('topbarFormatName');

    if (format.id === 'none') {
      if (badge) badge.style.display = 'none';
      if (topbarFormatName) topbarFormatName.textContent = 'Geen';
    } else {
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = format.label;
      }
      if (topbarFormatName) topbarFormatName.textContent = format.label;
    }
  }

  // ─── Berichten renderen ───────────────────────────────────────
  function renderMessage(role, contentText, format, timestamp) {
    const messages = document.getElementById('messages');
    const welcome = document.getElementById('welcomeScreen');
    if (!messages) return;

    if (welcome) welcome.style.display = 'none';

    const div = document.createElement('div');
    div.className = `message message--${role}`;

    const time = timestamp ? new Date(timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';
    const roleLabel = role === 'user' ? 'Jij' : 'Claude';
    const avatarLabel = role === 'user' ? 'U' : '◆';

    const htmlContent = role === 'assistant' ? renderMarkdown(contentText) : `<p>${escapeHtml(contentText).replace(/\n/g, '<br>')}</p>`;

    const formatTag = (format && format.id !== 'none')
      ? `<span class="format-tag">${format.label}</span>`
      : '';

    div.innerHTML = `
      <div class="message-avatar">${avatarLabel}</div>
      <div class="message-content">
        <div class="message-role">${roleLabel}</div>
        <div class="message-text">${htmlContent}</div>
        <div class="message-meta">
          <span class="message-time">${time}</span>
          ${formatTag}
          ${role === 'assistant' ? `<button class="copy-btn" data-text="${escapeAttr(contentText)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Kopiëren
          </button>` : ''}
        </div>
      </div>`;

    // Copy-knop
    const copyBtn = div.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = copyBtn.dataset.text;
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Gekopieerd`;
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Kopiëren`;
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });
    }

    messages.appendChild(div);
    scrollToBottom();

    return div;
  }

  function showTyping() {
    const messages = document.getElementById('messages');
    const welcome = document.getElementById('welcomeScreen');
    if (!messages) return null;
    if (welcome) welcome.style.display = 'none';

    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typingIndicator';
    el.innerHTML = `
      <div class="message-avatar" style="width:28px;height:28px;border-radius:50%;background:var(--accent-dim);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;">◆</div>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span class="typing-label">Claude denkt na…</span>`;
    messages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  function showError(text) {
    const chatArea = document.getElementById('chatArea');
    const existingErrors = chatArea.querySelectorAll('.error-message');
    existingErrors.forEach(e => e.remove());

    const el = document.createElement('div');
    el.className = 'error-message';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${text}</span>`;
    chatArea.appendChild(el);
    scrollToBottom();
  }

  function clearMessages() {
    const messages = document.getElementById('messages');
    const welcome = document.getElementById('welcomeScreen');
    if (messages) messages.innerHTML = '';
    if (welcome) welcome.style.display = 'flex';
  }

  function scrollToBottom() {
    const chatArea = document.getElementById('chatArea');
    if (chatArea) {
      requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
      });
    }
  }

  // ─── Bestandslijst ────────────────────────────────────────────
  function renderFileList(files, onRemove) {
    const list = document.getElementById('fileList');
    if (!list) return;

    list.innerHTML = files.map((f, i) => `
      <div class="file-item" data-index="${i}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="file-item-name" title="${f.name}">${f.name}</span>
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-3);margin-left:auto;flex-shrink:0;">${formatBytes(f.size)}</span>
        <button class="file-remove" data-index="${i}" title="Verwijderen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `).join('');

    list.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.index)));
    });
  }

  function renderAttachmentChips(files, onRemove) {
    const container = document.getElementById('inputAttachments');
    if (!container) return;

    if (files.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = files.map((f, i) => `
      <div class="attach-chip">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        <span>${f.name}</span>
        <button class="attach-remove" data-index="${i}" title="Verwijderen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.attach-remove').forEach(btn => {
      btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.index)));
    });
  }

  // ─── Statistieken ─────────────────────────────────────────────
  function updateStats(messageCount, estimatedTokens) {
    const msgEl = document.getElementById('statMessages');
    const tokEl = document.getElementById('statTokens');
    if (msgEl) msgEl.textContent = messageCount;
    if (tokEl) tokEl.textContent = `~${estimatedTokens.toLocaleString('nl-NL')}`;
  }

  // ─── Export modal ─────────────────────────────────────────────
  function renderExportFormats(currentFormat) {
    const container = document.getElementById('exportFormats');
    if (!container) return;

    const formats = [
      { id: 'docx', label: 'Word', ext: '.docx', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>` },
      { id: 'pdf', label: 'PDF', ext: '.pdf', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>` },
      { id: 'html', label: 'HTML', ext: '.html', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>` },
      { id: 'markdown', label: 'Markdown', ext: '.md', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-7"/></svg>` },
      { id: 'txt', label: 'Tekst', ext: '.txt', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/></svg>` },
      { id: 'json', label: 'JSON', ext: '.json', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/></svg>` }
    ];

    container.innerHTML = formats.map(f => `
      <button class="export-format-btn ${f.id === currentFormat ? 'active' : ''}" data-id="${f.id}">
        ${f.icon}
        <span class="ext">${f.ext}</span>
        <span>${f.label}</span>
      </button>
    `).join('');

    let selected = currentFormat || 'docx';
    const markActive = () => {
      container.querySelectorAll('.export-format-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.id === selected);
      });
    };

    container.querySelectorAll('.export-format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selected = btn.dataset.id;
        markActive();
        container.dataset.selected = selected;
      });
    });

    container.dataset.selected = selected;
  }

  // ─── Hulpfuncties ─────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '&#10;');
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    formatBytes
  };
})();
