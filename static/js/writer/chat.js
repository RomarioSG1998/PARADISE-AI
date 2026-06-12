/* =========================================================================
   writer/chat.js — Main AI chat panel (load, render, send, reset)
   ========================================================================= */
import { formatMarkdownSimple, generateLineDiff, showToast } from './ui.js';
import { updateStats, setSaveStatus, saveCurrentDocument } from './editor.js';
import { state } from './state.js';

const getEl = (id) => document.getElementById(id);

// ── Load & Render ─────────────────────────────────────────────────────────────
export async function loadChatMessages(force = false) {
    if (state.chatLoading && !force) return;
    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/messages`);
        const msgs = await res.json();
        const serialized = JSON.stringify(msgs);
        if (!force && state.lastMessagesJson === serialized) {
            return;
        }
        state.lastMessagesJson = serialized;
        renderChatMessages(msgs);
    } catch (err) {
        console.error('Error loading chat messages:', err);
    }
}

export async function resetChatHistory() {
    if (!state.currentEnvId) return;
    if (!confirm('Tem certeza de que deseja limpar todo o histórico de mensagens deste ambiente? Esta ação é irreversível.')) return;
    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/messages`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Histórico de mensagens reiniciado com sucesso!', 'success');
            loadChatMessages(true);
        } else {
            showToast(data.error || 'Erro ao reiniciar histórico.', 'error');
        }
    } catch {
        showToast('Falha ao reiniciar histórico de mensagens.', 'error');
    }
}
export function parseAgentMessagePayload(msgStr) {
    if (!msgStr) return { report: '', proposal: null };
    const trimmed = msgStr.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object') {
                return { report: parsed.report || '', proposal: parsed.proposal || null };
            }
        } catch { /* not JSON */ }
    }
    return { report: msgStr, proposal: null };
}

export function renderChatMessages(msgs) {
    const container = getEl('chat-messages-container');
    if (!container) return;
    container.innerHTML = '';

    if (msgs.length === 0) {
        container.innerHTML = `
            <div class="chat-bubble ai">
                <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="chat-text"><p>Olá! Sou o seu assistente de escrita inteligente. Envie materiais de apoio e diga o que você deseja escrever para começarmos a colaborar juntos!</p></div>
            </div>`;
        return;
    }

    msgs.forEach(m => {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${m.sender}`;
        const avatar = m.sender === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

        let formattedMsg = '';
        let proposalHtml = '';

        if (m.sender === 'ai') {
            const payload = parseAgentMessagePayload(m.message);
            formattedMsg = formatMarkdownSimple(payload.report);
            if (payload.proposal) {
                const base64Content = btoa(unescape(encodeURIComponent(payload.proposal.content)));
                const diffLinesHtml = generateLineDiff(payload.proposal.original_content || '', payload.proposal.content || '');
                proposalHtml = _buildProposalCard(payload.proposal, base64Content, diffLinesHtml);
            }
        } else {
            formattedMsg = formatMarkdownSimple(m.message);
        }

        const actionsHtml = (m.sender === 'ai' && !proposalHtml) ? _buildApplyBtn() : '';

        bubble.innerHTML = `
            <div class="chat-avatar">${avatar}</div>
            <div class="chat-text">
                <div>${formattedMsg}</div>
                ${proposalHtml}
                ${actionsHtml}
            </div>`;
        container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
}

// ── Send Message ──────────────────────────────────────────────────────────────

export async function sendChatMessage() {
    const chatInput = getEl('chat-input');
    const chatSendBtn = getEl('chat-send-btn');
    const container = getEl('chat-messages-container');
    if (!state.currentEnvId || state.chatLoading) return;
    const message = chatInput?.value.trim();
    if (!message) return;

    chatInput.value = '';
    chatInput.style.height = '32px';
    state.chatLoading = true;
    if (chatSendBtn) chatSendBtn.disabled = true;

    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.innerHTML = `<div class="chat-avatar"><i class="fa-solid fa-user"></i></div><div class="chat-text"><p>${message.replace(/\n/g, '<br>')}</p></div>`;
    container?.appendChild(userBubble);
    container?.scrollTo(0, container.scrollHeight);

    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'chat-bubble ai loading-bubble';
    loadingBubble.innerHTML = `<div class="chat-avatar"><i class="fa-solid fa-robot"></i></div><div class="chat-text"><div class="chat-loading"><div></div><div></div><div></div></div></div>`;
    container?.appendChild(loadingBubble);
    container?.scrollTo(0, container.scrollHeight);

    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, active_doc_id: state.currentDocId })
        });
        const data = await res.json();
        container?.querySelector('.loading-bubble')?.remove();

        if (data.success) {
            await loadChatMessages(true);

            if (data.document_update != null) {
                const richEditor = getEl('rich-editor');
                window.previousEditorContent = richEditor?.innerHTML;
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = data.document_update;
                tempDiv.querySelectorAll('style, script, head, meta, link, title').forEach(el => el.remove());
                let clean = tempDiv.innerHTML
                    .replace(/<!DOCTYPE[^>]*>/gi, '')
                    .replace(/<html[^>]*>/gi, '')
                    .replace(/<\/html>/gi, '')
                    .replace(/<body[^>]*>/gi, '')
                    .replace(/<\/body>/gi, '');
                if (richEditor) {
                    richEditor.innerHTML = clean;
                    richEditor.style.transition = 'none';
                    richEditor.style.backgroundColor = 'rgba(253,224,71,0.2)';
                    setTimeout(() => {
                        richEditor.style.transition = 'background-color 0.8s ease';
                        richEditor.style.backgroundColor = 'transparent';
                    }, 100);
                }
                updateStats();
                setSaveStatus('unsaved');
                const overlay = getEl('ai-review-overlay');
                if (overlay) overlay.style.display = 'block';
            }
        } else {
            alert('Falha na resposta: ' + data.error);
        }
    } catch (err) {
        console.error('Error sending message:', err);
        container?.querySelector('.loading-bubble')?.remove();
    } finally {
        state.chatLoading = false;
        if (chatSendBtn) chatSendBtn.disabled = false;
        container?.scrollTo(0, container.scrollHeight);
    }
}

// ── AI Review Overlay ─────────────────────────────────────────────────────────

export function acceptAiChanges() {
    const overlay = getEl('ai-review-overlay');
    if (overlay) overlay.style.display = 'none';
    saveCurrentDocument();
}

export function rejectAiChanges() {
    const overlay = getEl('ai-review-overlay');
    if (overlay) overlay.style.display = 'none';
    const richEditor = getEl('rich-editor');
    if (window.previousEditorContent !== undefined && richEditor) {
        richEditor.innerHTML = window.previousEditorContent;
        updateStats();
        setSaveStatus('saved');
    }
}

export async function applyProposedChange(btn, documentId, base64Content) {
    const agentModal = document.getElementById('agent-chat-modal');
    if (agentModal && agentModal.classList.contains('active')) {
        if (window.closeWriterModal) {
            window.closeWriterModal('agent-chat-modal');
        }
    }
    
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.value = "Por favor, aplique as alterações propostas pelo subagente para o documento.";
        await sendChatMessage();
    }
}


// ── Private Helpers ───────────────────────────────────────────────────────────

function _buildApplyBtn() {
    return `<div class="chat-bubble-actions" style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">
        <button class="chat-action-btn" onclick="window.applyChatToEditor(this)" style="background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.35);color:#d8b4fe;padding:4px 8px;border-radius:4px;font-size:0.72rem;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:4px;">
            <i class="fa-solid fa-file-import"></i> Aplicar no Editor
        </button>
    </div>`;
}

function _buildProposalCard(proposal, base64Content, diffLinesHtml) {
    return `<div class="proposed-change-card" style="margin-top:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(168,85,247,0.25);border-radius:10px;padding:12px;">
        <div style="font-size:0.75rem;font-weight:600;color:#d8b4fe;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-file-pen"></i> Alterações Propostas em: <strong>${proposal.document_title}</strong>
        </div>
        <div class="diff-container">${diffLinesHtml || '<div style="color:var(--text-muted);font-style:italic;padding:4px;">Nenhuma alteração textual detectada.</div>'}</div>
        <div style="display:flex;justify-content:flex-end;">
            <button class="approve-proposal-btn" onclick="window.applyProposedChange(this,'${proposal.document_id}','${base64Content}')">
                <i class="fa-solid fa-circle-check"></i> Aprovar e Aplicar Alterações
            </button>
        </div>
    </div>`;
}
