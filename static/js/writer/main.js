/* =========================================================================
   writer/main.js — Orchestrator: wires all modules together
   =========================================================================
   Modules:
     state.js        — shared mutable state
     ui.js           — modals, toasts, markdown, diff engine, speech
     editor.js       — document editor, autosave, selection popover
     chat.js         — main AI chat panel
     workspaces.js   — environments, documents, materials, contexts
     dragdrop.js     — drag-and-drop file uploads
   ========================================================================= */

import { state } from './state.js';
import {
    openWriterModal, closeWriterModal, initSpeechRecognition
} from './ui.js';
import {
    setupFormattingToolbar,
    triggerAutoSave, saveCurrentDocument, updateStats, setSaveStatus,
    checkTextSelection, hideSelectionPopover, submitSelectionEdit,
    applyChatToEditor, selectDocument as editorSelectDocument
} from './editor.js';
import {
    loadChatMessages, sendChatMessage, resetChatHistory,
    acceptAiChanges, rejectAiChanges, applyProposedChange
} from './chat.js';
import {
    loadEnvironments, createEnvironment, deleteEnvironment,
    loadDocuments, createNewDocument, deleteDocument,
    loadMaterials, uploadMaterial, deleteMaterial,
    loadProductionContext, saveProductionContext, deleteProductionContext,
    updateUILayout
} from './workspaces.js';
import { setupDragAndDrop } from './dragdrop.js';

// ─── Citation modal ───────────────────────────────────────────────────────────
// (inline here as it's a specialised UI that reads from workspaces + editor)
function switchCitationModalTab(tab) {
    const textBtn = document.getElementById('citation-btn-text');
    const pdfBtn = document.getElementById('citation-btn-pdf');
    const textPane = document.getElementById('citation-modal-content');
    const pdfPane = document.getElementById('citation-modal-pdf-content');
    
    if (tab === 'text') {
        if (textBtn) textBtn.classList.add('active');
        if (pdfBtn) pdfBtn.classList.remove('active');
        if (textPane) textPane.style.display = 'block';
        if (pdfPane) pdfPane.style.display = 'none';
        
        // Scroll to highlighted text if available
        const hl = document.getElementById('citation-highlight');
        if (textPane && hl) {
            textPane.scrollTo({
                top: textPane.scrollTop + hl.getBoundingClientRect().top - textPane.getBoundingClientRect().top - (textPane.clientHeight / 2),
                behavior: 'smooth'
            });
        }
    } else {
        if (pdfBtn) pdfBtn.classList.add('active');
        if (textBtn) textBtn.classList.remove('active');
        if (textPane) textPane.style.display = 'none';
        if (pdfPane) pdfPane.style.display = 'block';
    }
}

async function openCitationModal(materialId, snippet, page) {
    const modal = document.getElementById('citation-modal');
    const titleEl = document.getElementById('citation-modal-title');
    const contentEl = document.getElementById('citation-modal-content');
    const pdfContentEl = document.getElementById('citation-modal-pdf-content');
    const tabsEl = document.getElementById('citation-modal-tabs');
    const textBtn = document.getElementById('citation-btn-text');
    const pdfBtn = document.getElementById('citation-btn-pdf');

    if (!modal || !contentEl) return;

    // Reset layout elements
    contentEl.style.display = 'block';
    if (pdfContentEl) {
        pdfContentEl.style.display = 'none';
        pdfContentEl.innerHTML = '';
    }
    if (tabsEl) tabsEl.style.display = 'none';
    if (textBtn) textBtn.classList.add('active');
    if (pdfBtn) pdfBtn.classList.remove('active');

    contentEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;color:var(--accent-purple);"></i> Carregando fonte original...</div>';
    openWriterModal('citation-modal');

    try {
        const url = `/api/writer/environments/${state.currentEnvId}/materials/${materialId}/text?snippet=${encodeURIComponent(snippet || '')}&page=${encodeURIComponent(page || '')}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            const pageLabel = (page && page !== 'n/a') ? ` (Pág. ${page})` : '';
            if (titleEl) titleEl.textContent = `Origem da Citação: ${data.name}${pageLabel}`;

            let fullText = data.content_text || '';
            let highlighted = false;
            let index = -1, matchLength = 0;

            if (snippet && snippet.trim().length > 3) {
                // Normalize to lowercase, keep only alphanumeric and accented characters
                const normalize = (s) => s.toLowerCase()
                                          .replace(/[^a-z0-9à-ÿ]/g, ' ')
                                          .replace(/\s+/g, ' ')
                                          .trim();
                const normFull = normalize(fullText);
                const normSnippet = normalize(snippet.trim());

                // 1. Direct exact match of normalized snippet
                const normIdx = normFull.indexOf(normSnippet);
                if (normIdx !== -1) {
                    const words = normSnippet.split(' ').filter(w => w.length > 0)
                                             .map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
                    if (words.length > 0) {
                        try {
                            const regexStr = words.join('[^a-zA-Z0-9À-ÿ]+');
                            const m = fullText.match(new RegExp(regexStr, 'i'));
                            if (m) { index = m.index; matchLength = m[0].length; }
                        } catch (e) { }
                    }
                }

                // 2. Fallback 1: Match first few words (up to 5 words)
                if (index === -1) {
                    const words = normSnippet.split(' ').filter(w => w.length > 2);
                    const sampleWords = words.slice(0, Math.min(5, words.length));
                    if (sampleWords.length >= 2) {
                        try {
                            const regexStr = sampleWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('[^a-zA-Z0-9À-ÿ]+');
                            const m = fullText.match(new RegExp(regexStr, 'i'));
                            if (m) { index = m.index; matchLength = m[0].length; }
                        } catch (e) { }
                    }
                }

                // 3. Fallback 2: Match last few words (up to 5 words)
                if (index === -1) {
                    const words = normSnippet.split(' ').filter(w => w.length > 2);
                    const sampleWords = words.slice(-Math.min(5, words.length));
                    if (sampleWords.length >= 2) {
                        try {
                            const regexStr = sampleWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('[^a-zA-Z0-9À-ÿ]+');
                            const m = fullText.match(new RegExp(regexStr, 'i'));
                            if (m) { index = m.index; matchLength = m[0].length; }
                        } catch (e) { }
                    }
                }

                // 4. Fallback 3: Longest word
                if (index === -1) {
                    const words = normSnippet.split(' ').filter(w => w.length > 4);
                    if (words.length > 0) {
                        words.sort((a, b) => b.length - a.length);
                        const longestWord = words[0].replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        try {
                            const m = fullText.match(new RegExp(longestWord, 'i'));
                            if (m) { index = m.index; matchLength = m[0].length; }
                        } catch (e) { }
                    }
                }

                if (index !== -1) {
                    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                    contentEl.innerHTML = esc(fullText.substring(0, index)) +
                        `<mark id="citation-highlight" style="background:#eab308;color:#000;padding:2px 6px;border-radius:4px;font-weight:bold;border:1px solid #ca8a04;box-shadow:0 0 10px rgba(234,179,8,0.4);">` +
                        esc(fullText.substring(index, index + matchLength)) + '</mark>' +
                        esc(fullText.substring(index + matchLength));
                    highlighted = true;
                }
            }

            if (!highlighted) {
                contentEl.textContent = fullText;
            }

            // Setup PDF View if available
            if (data.has_pdf && data.pdf_url && pdfContentEl && tabsEl) {
                // Show tabs header
                tabsEl.style.display = 'flex';
                
                // Embed PDF
                const pdfPage = data.pdf_page || (page && page !== 'n/a' ? page : null);
                const cleanSnippet = snippet ? snippet.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]?]/g, '').replace(/\s+/g, ' ').trim() : '';
                const words = cleanSnippet.split(' ').filter(w => w.length > 2);
                const searchPhrase = words.slice(0, 4).join(' '); // 4 words is a safe length for browser search
                
                let pdfParams = [];
                if (pdfPage) pdfParams.push(`page=${pdfPage}`);
                if (searchPhrase) pdfParams.push(`search=${encodeURIComponent(searchPhrase)}`);
                
                const pdfUrl = pdfParams.length > 0 ? `${data.pdf_url}#${pdfParams.join('&')}` : data.pdf_url;
                pdfContentEl.innerHTML = `<iframe src="${pdfUrl}" style="width:100%;height:100%;border:none;border-radius:4px;background:white;"></iframe>`;
                
                // Connect tab events
                if (textBtn) textBtn.onclick = () => switchCitationModalTab('text');
                if (pdfBtn) pdfBtn.onclick = () => switchCitationModalTab('pdf');
                
                // Show PDF tab by default as requested to load inside the PDF viewer
                switchCitationModalTab('pdf');
            } else {
                if (tabsEl) tabsEl.style.display = 'none';
                if (pdfContentEl) {
                    pdfContentEl.style.display = 'none';
                    pdfContentEl.innerHTML = '';
                }
                contentEl.style.display = 'block';
            }

            // Smooth scroll to highlight after a short delay
            if (highlighted) {
                setTimeout(() => {
                    const hl = document.getElementById('citation-highlight');
                    if (contentEl && hl) {
                        contentEl.scrollTo({
                            top: contentEl.scrollTop + hl.getBoundingClientRect().top - contentEl.getBoundingClientRect().top - (contentEl.clientHeight / 2),
                            behavior: 'smooth'
                        });
                    }
                }, 250);
            }
        } else {
            contentEl.innerHTML = `<div style="color:var(--accent-pink);text-align:center;padding:20px;"><i class="fa-solid fa-triangle-exclamation" style="margin-bottom:10px;font-size:24px;"></i><br>${data.error || 'Erro ao carregar o conteúdo do material.'}</div>`;
        }
    } catch (err) {
        console.error(err);
        contentEl.innerHTML = '<div style="color:var(--accent-pink);text-align:center;padding:20px;">Erro de rede ao carregar citação.</div>';
    }
}



// ─── Environment Selection ────────────────────────────────────────────────────
async function selectEnvironment(id, name) {
    state.currentEnvId = id;
    state.currentDocId = null;
    state.lastMessagesJson = null;
    const activeEnvDisplay = document.getElementById('active-env-display');
    if (activeEnvDisplay) activeEnvDisplay.textContent = name;

    document.querySelectorAll('.env-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.env-item[data-id="${id}"]`);
    if (activeEl) activeEl.classList.add('active');

    updateUILayout();

    await loadDocuments();
    await loadMaterials();
    await loadChatMessages();
    await loadProductionContext();

    // Start background polling
    if (state.chatMessagesPollInterval) clearInterval(state.chatMessagesPollInterval);
    state.chatMessagesPollInterval = setInterval(async () => {
        if (state.currentEnvId) {
            await loadChatMessages();
        }
    }, 5000);

    if (state.documents.length > 0) {
        editorSelectDocument(state.documents[0].id, state.documents[0].title, state.documents[0].content);
    } else {
        await createNewDocument();
    }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
    // Environment modal
    const newEnvBtn = document.getElementById('new-env-btn');
    const startEnvBtn = document.getElementById('start-env-btn');
    const saveNewEnvBtn = document.getElementById('save-new-env-btn');
    newEnvBtn?.addEventListener('click', () => openWriterModal('new-env-modal'));
    startEnvBtn?.addEventListener('click', () => openWriterModal('new-env-modal'));
    saveNewEnvBtn?.addEventListener('click', createEnvironment);

    // Documents
    document.getElementById('new-doc-btn')?.addEventListener('click', createNewDocument);

    // Materials
    document.getElementById('upload-material-btn')?.addEventListener('click', () => {
        if (!state.currentEnvId) return;
        const overlay = document.getElementById('drag-drop-overlay');
        if (overlay) overlay.style.display = 'flex';
    });
    document.getElementById('upload-material-form')?.addEventListener('submit', uploadMaterial);

    // Editor autosave
    document.getElementById('doc-title-input')?.addEventListener('input', triggerAutoSave);
    document.getElementById('rich-editor')?.addEventListener('input', () => { updateStats(); triggerAutoSave(); });

    // Chat
    const chatInput = document.getElementById('chat-input');
    chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
    chatInput?.addEventListener('input', function () {
        this.style.height = '32px';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });
    document.getElementById('chat-send-btn')?.addEventListener('click', () => sendChatMessage());

    // Chat reset
    document.getElementById('reset-chat-btn')?.addEventListener('click', resetChatHistory);

    // AI Review overlay
    window.acceptAiChanges = acceptAiChanges;
    window.rejectAiChanges = rejectAiChanges;

    // Floating selection popover
    const richEditor = document.getElementById('rich-editor');
    richEditor?.addEventListener('mouseup', checkTextSelection);
    richEditor?.addEventListener('keyup', checkTextSelection);
    document.addEventListener('mousedown', (e) => {
        const popover = document.getElementById('selection-ia-popover');
        if (popover?.style.display !== 'none') {
            if (!popover.contains(e.target) && !richEditor?.contains(e.target)) hideSelectionPopover();
        }
    });
    document.getElementById('selection-ia-submit')?.addEventListener('click', submitSelectionEdit);
    document.getElementById('selection-ia-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitSelectionEdit(); }
    });

    // Context modal
    document.getElementById('edit-context-btn')?.addEventListener('click', () => openWriterModal('edit-context-modal'));
    document.getElementById('edit-context-form')?.addEventListener('submit', saveProductionContext);

    // Citation click delegation
    document.addEventListener('click', async (e) => {
        const citationEl = e.target.closest('.writer-citation');
        if (citationEl) {
            e.preventDefault();
            const id = citationEl.getAttribute('data-material-id');
            const snippet = citationEl.getAttribute('data-snippet');
            const page = citationEl.getAttribute('data-page');
            if (id) await openCitationModal(id, snippet, page);
        }
    });

    // Material tab switcher
    window.switchMaterialTab = (btn, tabId) => {
        document.querySelectorAll('.material-tab-link').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.material-tab-pane').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(tabId)?.classList.add('active');
    };

    // Voice speech-to-text
    const micBindings = [
        ['chat-mic-btn', 'chat-input'],
        ['selection-ia-mic', 'selection-ia-input'],
        ['context-name-mic', 'context-name-input'],
        ['context-text-mic', 'context-text-input'],
        ['env-name-mic', 'env-name-input'],
        ['material-name-mic', 'material-name-input'],
    ];
    micBindings.forEach(([btnId, inputId]) => initSpeechRecognition(btnId, inputId));
}

// ─── Connection Status ────────────────────────────────────────────────────────
async function checkConnectionStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const badge = document.getElementById('conn-badge');
        if (!badge) return;
        const dot = badge.querySelector('.badge-dot');
        const label = badge.querySelector('.badge-label');
        if (data.active) {
            if (dot) dot.className = 'badge-dot active';
            if (label) label.textContent = 'IA Conectada Pro';
        } else {
            if (dot) dot.className = 'badge-dot';
            if (label) label.textContent = 'Sem Provedor Ativo';
        }
    } catch (err) {
        console.error('Status check failed:', err);
    }
}

// ─── Expose globals for inline onclick attributes ─────────────────────────────
window.openWriterModal = openWriterModal;
window.closeWriterModal = closeWriterModal;
window.selectEnvironment = selectEnvironment;
window.deleteEnvironment = deleteEnvironment;
window.deleteDocument = deleteDocument;
window.deleteMaterial = deleteMaterial;
window.deleteProductionContext = deleteProductionContext;
window.resetChatHistory = resetChatHistory;
window.openCitationModal = openCitationModal;
window.switchCitationModalTab = switchCitationModalTab;
window.applyChatToEditor = applyChatToEditor;
window.applyProposedChange = applyProposedChange;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadEnvironments();
    checkConnectionStatus();
    setupEventListeners();
    setupFormattingToolbar();
    setupDragAndDrop();
});
