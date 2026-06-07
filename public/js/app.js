/**
 * APP.JS
 * Hoofd applicatielogica — staat, interacties en eventementen
 */

(function () {
  'use strict';

  // ─── Applicatiestatus ─────────────────────────────────────────
  const state = {
    model: CONFIG.DEFAULT_MODEL,
    format: 'none',
    messages: [],          // API history: [{role, content, timestamp}]
    uploads: [],           // File objects voor upload
    isLoading: false,
    sidebarVisible: true
  };

  // ─── DOM elementen ────────────────────────────────────────────
  const els = {
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    topbarMenu: document.getElementById('topbarMenu'),
    modelSelectorWrapper: document.getElementById('modelSelectorWrapper'),
    modelCurrentBtn: document.getElementById('modelCurrentBtn'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    fileInput: document.getElementById('fileInput'),
    uploadZone: document.getElementById('uploadZone'),
    exportBtn: document.getElementById('exportBtn'),
    clearBtn: document.getElementById('clearBtn'),
    exportModal: document.getElementById('exportModal'),
    exportModalClose: document.getElementById('exportModalClose'),
    doExportBtn: document.getElementById('doExportBtn'),
    clearAfterExport: document.getElementById('clearAfterExport'),
    clearModal: document.getElementById('clearModal'),
    clearModalClose: document.getElementById('clearModalClose'),
    clearCancelBtn: document.getElementById('clearCancelBtn'),
    clearConfirmBtn: document.getElementById('clearConfirmBtn'),
    exportFormats: document.getElementById('exportFormats'),
    welcomeChips: document.querySelectorAll('.chip')
  };

  // ─── Initialisatie ────────────────────────────────────────────
  function init() {
    // Modellen
    UI.renderModels(state.model, selectModel);
    const currentModel = MODELS.find(m => m.id === state.model) || MODELS[0];
    UI.setCurrentModel(currentModel);

    // Formaten
    UI.renderFormats(state.format, selectFormat);
    const currentFormat = OUTPUT_FORMATS.find(f => f.id === state.format);
    UI.setCurrentFormat(currentFormat);

    // Events
    bindEvents();

    // Textarea auto-resize
    autoResizeTextarea();

    // Stat update
    updateStats();
  }

  // ─── Event bindings ───────────────────────────────────────────
  function bindEvents() {
    // Sidebar toggle
    els.sidebarToggle?.addEventListener('click', toggleSidebar);
    els.topbarMenu?.addEventListener('click', toggleSidebar);

    // Model dropdown toggle
    els.modelCurrentBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      els.modelSelectorWrapper.classList.toggle('open');
    });

    // Sluit dropdown bij klik buiten
    document.addEventListener('click', (e) => {
      if (!els.modelSelectorWrapper?.contains(e.target)) {
        els.modelSelectorWrapper?.classList.remove('open');
      }
    });

    // Verzenden
    els.sendBtn?.addEventListener('click', sendMessage);
    els.userInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    els.userInput?.addEventListener('input', autoResizeTextarea);

    // Bestanden uploaden
    els.fileInput?.addEventListener('change', handleFileSelect);
    els.uploadZone?.addEventListener('dragover', handleDragOver);
    els.uploadZone?.addEventListener('dragleave', handleDragLeave);
    els.uploadZone?.addEventListener('drop', handleDrop);

    // Export modal
    els.exportBtn?.addEventListener('click', openExportModal);
    els.exportModalClose?.addEventListener('click', closeExportModal);
    els.doExportBtn?.addEventListener('click', doExport);
    els.exportModal?.addEventListener('click', (e) => {
      if (e.target === els.exportModal) closeExportModal();
    });

    // Clear modal
    els.clearBtn?.addEventListener('click', openClearModal);
    els.clearModalClose?.addEventListener('click', closeClearModal);
    els.clearCancelBtn?.addEventListener('click', closeClearModal);
    els.clearConfirmBtn?.addEventListener('click', clearChat);
    document.getElementById('clearModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('clearModal')) closeClearModal();
    });

    // Welcome chips
    els.welcomeChips?.forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (els.userInput) {
          els.userInput.value = prompt;
          els.userInput.focus();
          autoResizeTextarea();
        }
      });
    });

    // Mobiele overlay
    const overlay = createSidebarOverlay();
    overlay.addEventListener('click', toggleSidebar);
  }

  // ─── Sidebar ──────────────────────────────────────────────────
  function createSidebarOverlay() {
    let overlay = document.getElementById('sidebarOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function toggleSidebar() {
    const isMobile = window.innerWidth <= 720;
    const overlay = document.getElementById('sidebarOverlay');

    if (isMobile) {
      els.sidebar.classList.toggle('visible');
      overlay?.classList.toggle('visible', els.sidebar.classList.contains('visible'));
    } else {
      state.sidebarVisible = !state.sidebarVisible;
      els.sidebar.classList.toggle('hidden', !state.sidebarVisible);
    }
  }

  // ─── Model selectie ───────────────────────────────────────────
  function selectModel(modelId) {
    state.model = modelId;
    const model = MODELS.find(m => m.id === modelId);
    if (model) UI.setCurrentModel(model);
  }

  // ─── Formaat selectie ─────────────────────────────────────────
  function selectFormat(formatId) {
    state.format = formatId;
    const format = OUTPUT_FORMATS.find(f => f.id === formatId);
    if (format) UI.setCurrentFormat(format);
  }

  // ─── Bestand handling ─────────────────────────────────────────
  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    e.target.value = '';
  }

  function handleDragOver(e) {
    e.preventDefault();
    els.uploadZone?.classList.add('drag-over');
  }

  function handleDragLeave() {
    els.uploadZone?.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.preventDefault();
    els.uploadZone?.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files || []);
    addFiles(files);
  }

  function addFiles(files) {
    const validFiles = files.filter(f => {
      if (f.size > CONFIG.MAX_FILE_SIZE) {
        UI.showError(`Bestand "${f.name}" is te groot (max ${UI.formatBytes(CONFIG.MAX_FILE_SIZE)}).`);
        return false;
      }
      return true;
    });

    state.uploads = [...state.uploads, ...validFiles];
    UI.renderFileList(state.uploads, removeFile);
    UI.renderAttachmentChips(state.uploads, removeFile);
  }

  function removeFile(index) {
    state.uploads.splice(index, 1);
    UI.renderFileList(state.uploads, removeFile);
    UI.renderAttachmentChips(state.uploads, removeFile);
  }

  // ─── Bericht verzenden ────────────────────────────────────────
  async function sendMessage() {
    if (state.isLoading) return;

    const text = els.userInput?.value.trim();
    if (!text && state.uploads.length === 0) return;

    state.isLoading = true;
    if (els.sendBtn) els.sendBtn.disabled = true;
    if (els.userInput) els.userInput.value = '';
    autoResizeTextarea();

    const format = OUTPUT_FORMATS.find(f => f.id === state.format);
    const timestamp = new Date().toISOString();

    // Bouw content array op
    let userContent = [];

    // Voeg uploads toe
    if (state.uploads.length > 0) {
      try {
        const fileContents = await Promise.all(state.uploads.map(f => API.readFileForAPI(f)));
        userContent.push(...fileContents);
      } catch (err) {
        UI.showError(`Fout bij laden van bestanden: ${err.message}`);
        state.isLoading = false;
        if (els.sendBtn) els.sendBtn.disabled = false;
        return;
      }
    }

    // Voeg tekst toe
    if (text) {
      userContent.push({ type: 'text', text });
    }

    // Render gebruikersbericht
    const fileNames = state.uploads.map(f => f.name).join(', ');
    const displayText = fileNames
       ? (text ? `📎 ${fileNames}\n\n${text}` : `📎 ${fileNames}`)
       : text;
    UI.renderMessage('user', displayText, null, timestamp);

    // Voeg toe aan API-geschiedenis
    const userMsg = {
      role: 'user',
      content: userContent.length === 1 && userContent[0].type === 'text'
        ? userContent[0].text
        : userContent,
      timestamp
    };
    state.messages.push(userMsg);

    // Wis uploads na verzenden
    const uploadedFiles = [...state.uploads];
    state.uploads = [];
    UI.renderFileList([], removeFile);
    UI.renderAttachmentChips([], removeFile);

    // Toon typing indicator
    UI.showTyping();

    // Bouw systeem prompt op
    let systemPrompt = CONFIG.SYSTEM_PROMPT;
    if (format && format.id !== 'none' && format.instruction) {
      systemPrompt += `\n\n[UITVOERFORMAAT INSTRUCTIE]\n${format.instruction}`;
    }

    // Bereid messages voor (zonder timestamps voor API)
    const apiMessages = state.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const response = await API.sendMessage(apiMessages, state.model, systemPrompt);

      UI.hideTyping();

      const aiTimestamp = new Date().toISOString();
      UI.renderMessage('assistant', response, format, aiTimestamp);

      // Bewaar AI-antwoord
      state.messages.push({
        role: 'assistant',
        content: response,
        timestamp: aiTimestamp
      });

      updateStats();

    } catch (err) {
      UI.hideTyping();
      UI.showError(`API fout: ${err.message}`);
      // Verwijder het laatste gebruikersbericht uit history bij fout
      state.messages.pop();
    }

    state.isLoading = false;
    if (els.sendBtn) els.sendBtn.disabled = false;
    if (els.userInput) els.userInput.focus();
  }

  // ─── Export modal ─────────────────────────────────────────────
  function openExportModal() {
    if (state.messages.length === 0) {
      UI.showError('Er zijn nog geen berichten om te exporteren.');
      return;
    }
    UI.renderExportFormats('docx');
    if (els.exportModal) els.exportModal.style.display = 'flex';
  }

  function closeExportModal() {
    if (els.exportModal) els.exportModal.style.display = 'none';
  }

  async function doExport() {
    const selected = document.getElementById('exportFormats')?.dataset.selected || 'docx';
    const clearAfter = document.getElementById('clearAfterExport')?.checked;

    closeExportModal();

    await Exporter.exportChat(state.messages, selected);

    if (clearAfter) {
      performClear();
    }
  }

  // ─── Clear modal ──────────────────────────────────────────────
  function openClearModal() {
    if (document.getElementById('clearModal')) {
      document.getElementById('clearModal').style.display = 'flex';
    }
  }

  function closeClearModal() {
    if (document.getElementById('clearModal')) {
      document.getElementById('clearModal').style.display = 'none';
    }
  }

  function clearChat() {
    closeClearModal();
    performClear();
  }

  function performClear() {
    state.messages = [];
    state.uploads = [];
    UI.clearMessages();
    UI.renderFileList([], removeFile);
    UI.renderAttachmentChips([], removeFile);
    updateStats();
  }

  // ─── Statistieken ─────────────────────────────────────────────
  function updateStats() {
    const msgCount = state.messages.length;
    const tokens = estimateTokens(state.messages);
    UI.updateStats(msgCount, tokens);
  }

  function estimateTokens(messages) {
    let chars = 0;
    messages.forEach(m => {
      if (typeof m.content === 'string') {
        chars += m.content.length;
      } else if (Array.isArray(m.content)) {
        m.content.forEach(c => {
          if (c.type === 'text') chars += c.text.length;
          else if (c.type === 'image' || c.type === 'document') chars += 1000;
        });
      }
    });
    return Math.round(chars / 4);
  }

  // ─── Textarea auto-resize ─────────────────────────────────────
  function autoResizeTextarea() {
    const el = els.userInput;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  // ─── Start ────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

})();
