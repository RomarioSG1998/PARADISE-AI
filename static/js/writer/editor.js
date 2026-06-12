/* =========================================================================
   writer/editor.js — Document editor, autosave, formatting toolbar,
   floating selection popover, stats counter
   ========================================================================= */
import { openWriterModal, closeWriterModal, formatMarkdownSimple } from './ui.js';
import { state } from './state.js';

// DOM references (resolved at runtime)
const getEl = (id) => document.getElementById(id);

// ── Helpers ───────────────────────────────────────────────────────────────────

export function sanitizeEditorHtml(htmlStr) {
    if (!htmlStr) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlStr;
    tempDiv.querySelectorAll('style, script, head, meta, link, title').forEach(el => el.remove());
    let clean = tempDiv.innerHTML;
    clean = clean.replace(/<!DOCTYPE[^>]*>/gi, '');
    clean = clean.replace(/<html[^>]*>/gi, '');
    clean = clean.replace(/<\/html>/gi, '');
    clean = clean.replace(/<body[^>]*>/gi, '');
    clean = clean.replace(/<\/body>/gi, '');
    return clean;
}

// ── Document Selection ────────────────────────────────────────────────────────

export function selectDocument(id, title, content) {
    state.currentDocId = id;

    document.querySelectorAll('.doc-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.doc-item[data-id="${id}"]`);
    if (activeEl) activeEl.classList.add('active');

    const docTitleInput = getEl('doc-title-input');
    const richEditor = getEl('rich-editor');
    if (docTitleInput) docTitleInput.value = title === 'Sem título' ? '' : title;
    if (richEditor) richEditor.innerHTML = sanitizeEditorHtml(content || '');

    updateStats();
    setSaveStatus('saved');
}

// ── Auto-Save ─────────────────────────────────────────────────────────────────

let saveTimeout = null;

export function triggerAutoSave() {
    if (!state.currentEnvId || !state.currentDocId) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    setSaveStatus('saving');
    saveTimeout = setTimeout(saveCurrentDocument, 1200);
}

export async function saveCurrentDocument() {
    if (!state.currentEnvId || !state.currentDocId) return;
    const docTitleInput = getEl('doc-title-input');
    const richEditor = getEl('rich-editor');
    const title = (docTitleInput?.value.trim()) || 'Sem título';
    const content = richEditor?.innerHTML || '';

    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: state.currentDocId, title, content })
        });
        const data = await res.json();
        if (data.success) {
            setSaveStatus('saved');
            const activeEl = document.querySelector(`.doc-item[data-id="${state.currentDocId}"] span`);
            if (activeEl) activeEl.innerHTML = `<i class="fa-regular fa-file-lines"></i> ${title}`;
        }
    } catch {
        setSaveStatus('error');
    }
}

export function setSaveStatus(status) {
    const btn = getEl('save-status-btn');
    if (!btn) return;
    if (status === 'saving') {
        btn.className = 'save-indicator saving';
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
    } else if (status === 'saved') {
        btn.className = 'save-indicator';
        btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Salvo`;
    } else {
        btn.className = 'save-indicator error';
        btn.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Erro ao Salvar`;
    }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function updateStats() {
    const richEditor = getEl('rich-editor');
    const charCount = getEl('char-count');
    const wordCount = getEl('word-count');
    const text = richEditor?.innerText || richEditor?.textContent || '';
    const charLen = text.length;
    const cleanText = text.trim().replace(/\s+/g, ' ');
    const wordLen = cleanText === '' ? 0 : cleanText.split(' ').length;
    if (charCount) charCount.textContent = `${charLen} ${charLen === 1 ? 'caractere' : 'caracteres'}`;
    if (wordCount) wordCount.textContent = `${wordLen} ${wordLen === 1 ? 'palavra' : 'palavras'}`;
}

// ── Formatting Toolbar ────────────────────────────────────────────────────────

export function setupFormattingToolbar() {
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.val || null;
            document.execCommand(cmd, false, val);
            getEl('rich-editor')?.focus();
        });
    });
}

// ── Floating Selection Popover ────────────────────────────────────────────────

let lastSelectionRange = null;
let lastSelectedText = '';

export function getLastSelection() {
    return { range: lastSelectionRange, text: lastSelectedText };
}

export function checkTextSelection() {
    const richEditor = getEl('rich-editor');
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    if (text.length > 0 && richEditor?.contains(range.commonAncestorContainer)) {
        lastSelectionRange = range.cloneRange();
        lastSelectedText = text;
        showSelectionPopover(range);
    }
}

export function showSelectionPopover(range) {
    const popover = getEl('selection-ia-popover');
    if (!popover) return;
    popover.style.display = 'block';
    const rect = range.getBoundingClientRect();
    const w = popover.offsetWidth;
    const h = popover.offsetHeight;
    popover.style.top = `${Math.max(10, rect.top + window.scrollY - h - 10)}px`;
    popover.style.left = `${Math.max(10, rect.left + window.scrollX + (rect.width / 2) - (w / 2))}px`;
    const input = getEl('selection-ia-input');
    if (input) { input.value = ''; input.focus(); }
}

export function hideSelectionPopover() {
    const popover = getEl('selection-ia-popover');
    if (popover) popover.style.display = 'none';
    lastSelectionRange = null;
    lastSelectedText = '';
}

export async function submitSelectionEdit(sendMessageCallback) {
    const input = getEl('selection-ia-input');
    const submitBtn = getEl('selection-ia-submit');
    const chatMsgs = getEl('chat-messages-container');
    if (!input || !submitBtn || !lastSelectedText || !lastSelectionRange || !state.currentEnvId) return;

    const message = input.value.trim();
    if (!message) return;

    input.disabled = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner popover-loading-spinner"></i>';

    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.innerHTML = `<div class="chat-avatar"><i class="fa-solid fa-user"></i></div><div class="chat-text"><p>${message.replace(/\n/g, '<br>')}</p></div>`;
    chatMsgs?.appendChild(userBubble);
    chatMsgs?.scrollTo(0, chatMsgs.scrollHeight);

    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'chat-bubble ai loading-bubble';
    loadingBubble.innerHTML = `<div class="chat-avatar"><i class="fa-solid fa-robot"></i></div><div class="chat-text"><div class="chat-loading"><div></div><div></div><div></div></div></div>`;
    chatMsgs?.appendChild(loadingBubble);
    chatMsgs?.scrollTo(0, chatMsgs.scrollHeight);

    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, active_doc_id: state.currentDocId, selected_text: lastSelectedText })
        });
        const data = await res.json();
        chatMsgs?.querySelector('.loading-bubble')?.remove();

        if (data.success) {
            const aiBubble = document.createElement('div');
            aiBubble.className = 'chat-bubble ai';
            aiBubble.innerHTML = `<div class="chat-avatar"><i class="fa-solid fa-robot"></i></div><div class="chat-text"><div>${formatMarkdownSimple(data.message)}</div></div>`;
            chatMsgs?.appendChild(aiBubble);
            chatMsgs?.scrollTo(0, chatMsgs.scrollHeight);

            if (data.selection_update != null) {
                const richEditor = getEl('rich-editor');
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(lastSelectionRange);
                lastSelectionRange.deleteContents();
                const el = document.createElement('span');
                el.innerHTML = data.selection_update;
                el.style.cssText = 'background-color:rgba(168,85,247,0.25);transition:background-color 0.8s ease;border-radius:4px;padding:2px 4px;';
                lastSelectionRange.insertNode(el);
                selection.removeAllRanges();
                saveCurrentDocument();
                setTimeout(() => {
                    el.style.backgroundColor = 'transparent';
                    setTimeout(() => {
                        const parent = el.parentNode;
                        if (parent) {
                            while (el.firstChild) parent.insertBefore(el.firstChild, el);
                            parent.removeChild(el);
                        }
                        richEditor?.normalize();
                    }, 800);
                }, 500);
            }
        }
    } catch (err) {
        console.error('Error sending selection edit:', err);
    } finally {
        input.disabled = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        hideSelectionPopover();
    }
}

// ── Chat-to-Editor Apply ──────────────────────────────────────────────────────

export function applyChatToEditor(btn) {
    const richEditor = getEl('rich-editor');
    const textEl = btn.closest('.chat-text');
    if (!textEl) return;
    const clone = textEl.cloneNode(true);
    clone.querySelector('.chat-bubble-actions')?.remove();
    const html = clone.innerHTML.trim();
    richEditor?.focus();
    try {
        if (!document.execCommand('insertHTML', false, html)) richEditor.innerHTML += html;
    } catch {
        richEditor.innerHTML += html;
    }
    updateStats();
    saveCurrentDocument();
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Aplicado!';
    btn.style.cssText = 'border-color:#22c55e;color:#22c55e;background:rgba(34,197,94,0.15);';
    setTimeout(() => {
        btn.innerHTML = orig;
        btn.style.cssText = 'border-color:rgba(168,85,247,0.35);color:#d8b4fe;background:rgba(168,85,247,0.12);';
    }, 1500);
}
