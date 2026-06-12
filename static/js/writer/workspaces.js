/* =========================================================================
   writer/workspaces.js — Environments, Documents, Materials, Contexts CRUD
   ========================================================================= */
import { openWriterModal, closeWriterModal } from './ui.js';
import { selectDocument as editorSelectDocument } from './editor.js';
import { state } from './state.js';

const getEl = (id) => document.getElementById(id);

// ── Environments ──────────────────────────────────────────────────────────────

export async function loadEnvironments() {
    try {
        const res = await fetch('/api/writer/environments');
        state.environments = await res.json();
        renderEnvironments();
    } catch (err) {
        console.error('Error loading environments:', err);
    }
}

function renderEnvironments() {
    const container = getEl('envs-container');
    if (!container) return;
    container.innerHTML = '';

    if (state.environments.length === 0) {
        container.innerHTML = '<div class="empty-list-info">Nenhum ambiente</div>';
        return;
    }

    state.environments.forEach(env => {
        const item = document.createElement('div');
        item.className = `env-item ${state.currentEnvId == env.id ? 'active' : ''}`;
        item.dataset.id = env.id;
        item.innerHTML = `
            <span><i class="fa-solid fa-folder"></i> ${env.name}</span>
            <button class="delete-item-btn" onclick="window.deleteEnvironment(event, '${env.id}')"><i class="fa-solid fa-trash-can"></i></button>
        `;
        item.addEventListener('click', () => window.selectEnvironment(env.id, env.name));
        container.appendChild(item);
    });
}

export async function createEnvironment() {
    const nameInput = getEl('env-name-input');
    const name = nameInput?.value.trim();
    if (!name) return;

    try {
        const res = await fetch('/api/writer/environments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.success) {
            closeWriterModal('new-env-modal');
            if (nameInput) nameInput.value = '';
            await loadEnvironments();
            window.selectEnvironment(data.id, data.name);
        } else {
            alert('Erro: ' + data.error);
        }
    } catch (err) {
        console.error('Error creating environment:', err);
    }
}

export async function deleteEnvironment(event, id) {
    event.stopPropagation();
    if (!confirm('Deseja realmente excluir este ambiente e todos os seus materiais e documentos?')) return;

    try {
        const res = await fetch(`/api/writer/environments/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (state.currentEnvId == id) {
                state.currentEnvId = null;
                state.currentDocId = null;
                updateUILayout();
            }
            loadEnvironments();
        }
    } catch (err) {
        console.error('Error deleting environment:', err);
    }
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function loadDocuments() {
    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/documents`);
        state.documents = await res.json();
        renderDocuments();
    } catch (err) {
        console.error('Error loading documents:', err);
    }
}

function renderDocuments() {
    const container = getEl('docs-container');
    if (!container) return;
    container.innerHTML = '';

    if (state.documents.length === 0) {
        container.innerHTML = '<div class="empty-list-info">Nenhum texto</div>';
        return;
    }

    state.documents.forEach(doc => {
        const item = document.createElement('div');
        item.className = `doc-item ${state.currentDocId == doc.id ? 'active' : ''}`;
        item.dataset.id = doc.id;
        item.innerHTML = `
            <span><i class="fa-regular fa-file-lines"></i> ${doc.title}</span>
            <button class="delete-item-btn" onclick="window.deleteDocument(event, '${doc.id}')"><i class="fa-solid fa-trash-can"></i></button>
        `;
        item.addEventListener('click', () => editorSelectDocument(doc.id, doc.title, doc.content));
        container.appendChild(item);
    });
}

export async function createNewDocument() {
    if (!state.currentEnvId) return;
    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Sem título', content: '' })
        });
        const data = await res.json();
        if (data.success) {
            await loadDocuments();
            editorSelectDocument(data.id, 'Sem título', '');
        }
    } catch (err) {
        console.error('Error creating document:', err);
    }
}

export async function deleteDocument(event, id) {
    event.stopPropagation();
    if (!confirm('Deseja realmente excluir este documento?')) return;

    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/documents/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (state.currentDocId == id) {
                state.currentDocId = null;
                const docTitleInput = getEl('doc-title-input');
                const richEditor = getEl('rich-editor');
                const charCount = getEl('char-count');
                const wordCount = getEl('word-count');
                if (docTitleInput) docTitleInput.value = '';
                if (richEditor) richEditor.innerHTML = '';
                if (charCount) charCount.textContent = '0 caracteres';
                if (wordCount) wordCount.textContent = '0 palavras';
            }
            await loadDocuments();
            if (state.documents.length > 0) {
                editorSelectDocument(state.documents[0].id, state.documents[0].title, state.documents[0].content);
            }
        }
    } catch (err) {
        console.error('Error deleting document:', err);
    }
}

// ── Materials ─────────────────────────────────────────────────────────────────

export async function loadMaterials() {
    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/materials`);
        state.materials = await res.json();
        renderMaterials();
    } catch (err) {
        console.error('Error loading materials:', err);
    }
}

function renderMaterials() {
    const modelsContainer = getEl('models-container');
    const referencesContainer = getEl('references-container');

    const modelsList = state.materials.filter(m => m.material_type === 'model');
    const referencesList = state.materials.filter(m => m.material_type === 'reference');

    _renderMaterialList(modelsContainer, modelsList, 'Nenhum modelo enviado.');
    _renderMaterialList(referencesContainer, referencesList, 'Nenhum material enviado.');
}

function _renderMaterialList(container, list, emptyMsg) {
    if (!container) return;
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = `<div class="empty-list-info">${emptyMsg}</div>`;
        return;
    }
    list.forEach(m => {
        const item = document.createElement('div');
        item.className = 'material-item';
        item.innerHTML = `
            <span style="cursor:pointer;display:flex;align-items:center;gap:8px;" onclick="window.openCitationModal('${m.id}', null, null)"><i class="fa-solid fa-file-pdf material-icon"></i> ${m.name}</span>
            <button class="delete-item-btn" onclick="window.deleteMaterial(event, '${m.id}')"><i class="fa-solid fa-trash-can"></i></button>
        `;
        container.appendChild(item);
    });
}

export async function uploadMaterial(e) {
    e.preventDefault();
    if (!state.currentEnvId) return;

    const uploadMaterialForm = getEl('upload-material-form');
    const submitUploadBtn = getEl('submit-upload-btn');

    if (submitUploadBtn) {
        submitUploadBtn.disabled = true;
        submitUploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    }

    const formData = new FormData(uploadMaterialForm);
    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/materials`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            closeWriterModal('upload-material-modal');
            uploadMaterialForm?.reset();
            loadMaterials();
        } else {
            alert('Erro no envio: ' + data.error);
        }
    } catch (err) {
        console.error('Error uploading material:', err);
    } finally {
        if (submitUploadBtn) {
            submitUploadBtn.disabled = false;
            submitUploadBtn.innerHTML = 'Enviar Material';
        }
    }
}

export async function deleteMaterial(event, id) {
    event.stopPropagation();
    if (!confirm('Deseja excluir este material de apoio do ambiente?')) return;
    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/materials/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) loadMaterials();
    } catch (err) {
        console.error('Error deleting material:', err);
    }
}

// ── Production Contexts ───────────────────────────────────────────────────────

export async function loadProductionContext() {
    if (!state.currentEnvId) return;
    const container = getEl('context-display-container');
    if (!container) return;

    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/contexts`);
        const contexts = await res.json();

        container.innerHTML = '';
        if (contexts.length === 0) {
            container.innerHTML = '<div class="empty-list-info">Nenhum contexto de produção configurado. Clique no botão + para adicionar.</div>';
            return;
        }

        contexts.forEach(ctx => {
            const item = document.createElement('div');
            item.className = 'material-item';
            item.innerHTML = `
                <span title="${(ctx.content_text || '').replace(/"/g, '&quot;')}"><i class="fa-solid fa-bullseye material-icon"></i> ${ctx.name}</span>
                <button class="delete-item-btn" onclick="window.deleteProductionContext(event, '${ctx.id}')"><i class="fa-solid fa-trash-can"></i></button>
            `;
            container.appendChild(item);
        });
    } catch (err) {
        console.error('Error loading production contexts:', err);
        container.innerHTML = '<div class="empty-list-info">Erro ao carregar contexto.</div>';
    }
}

export async function saveProductionContext(event) {
    if (event) event.preventDefault();
    if (!state.currentEnvId) return;

    const submitBtn = getEl('submit-context-btn');
    const form = getEl('edit-context-form');
    const nameInput = getEl('context-name-input');
    const fileInput = getEl('context-file-input');
    const textInput = getEl('context-text-input');

    if (!form || !submitBtn) return;

    const name = nameInput?.value.trim();
    const textContent = textInput?.value.trim();
    const file = fileInput?.files?.length > 0 ? fileInput.files[0] : null;

    if (!name && !file) { alert('Por favor, informe o nome do contexto ou envie um arquivo.'); return; }
    if (!textContent && !file) { alert('Por favor, informe o texto do contexto ou envie um arquivo.'); return; }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('text_content', textContent);
    if (file) formData.append('file', file);

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/contexts`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            closeWriterModal('edit-context-modal');
            form.reset();
            await loadProductionContext();
        } else {
            alert('Erro ao salvar contexto: ' + (data.error || 'Erro desconhecido'));
        }
    } catch (err) {
        console.error('Error saving production context:', err);
        alert('Erro de rede ao salvar contexto.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Adicionar Contexto';
    }
}

export async function deleteProductionContext(event, id) {
    event.stopPropagation();
    if (!confirm('Deseja realmente excluir este item de contexto de produção?')) return;
    try {
        const res = await fetch(`/api/writer/environments/${state.currentEnvId}/contexts/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) await loadProductionContext();
    } catch (err) {
        console.error('Error deleting production context:', err);
    }
}

// ── UI Layout ─────────────────────────────────────────────────────────────────

export function updateUILayout() {
    const noEnvScreen = getEl('no-env-screen');
    const paperEditorContainer = getEl('paper-editor-container');
    const textToolbar = getEl('text-toolbar');
    const newDocBtn = getEl('new-doc-btn');
    const uploadMaterialBtn = getEl('upload-material-btn');
    const chatSendBtn = getEl('chat-send-btn');
    const resetChatBtn = getEl('reset-chat-btn');
    const activeEnvDisplay = getEl('active-env-display');
    const editContextBtn = getEl('edit-context-btn');
    const modelsContainer = getEl('models-container');
    const referencesContainer = getEl('references-container');
    const chatMessagesContainer = getEl('chat-messages-container');
    const docsContainer = getEl('docs-container');
    const contextContainer = getEl('context-display-container');

    if (state.currentEnvId) {
        if (noEnvScreen) noEnvScreen.style.display = 'none';
        if (paperEditorContainer) paperEditorContainer.style.display = 'flex';
        if (textToolbar) textToolbar.style.visibility = 'visible';
        if (newDocBtn) newDocBtn.disabled = false;
        if (uploadMaterialBtn) uploadMaterialBtn.disabled = false;
        if (chatSendBtn) chatSendBtn.disabled = false;
        if (resetChatBtn) resetChatBtn.disabled = false;
        if (editContextBtn) editContextBtn.disabled = false;
    } else {
        if (noEnvScreen) noEnvScreen.style.display = 'flex';
        if (paperEditorContainer) paperEditorContainer.style.display = 'none';
        if (textToolbar) textToolbar.style.visibility = 'hidden';
        if (activeEnvDisplay) activeEnvDisplay.textContent = 'Selecione um Ambiente';
        if (newDocBtn) newDocBtn.disabled = true;
        if (uploadMaterialBtn) uploadMaterialBtn.disabled = true;
        if (chatSendBtn) chatSendBtn.disabled = true;
        if (editContextBtn) editContextBtn.disabled = true;
        if (contextContainer) contextContainer.innerHTML = '<div class="empty-list-info">Selecione um ambiente para ver o contexto.</div>';
        if (modelsContainer) modelsContainer.innerHTML = '<div class="empty-list-info">Nenhum modelo enviado.</div>';
        if (referencesContainer) referencesContainer.innerHTML = '<div class="empty-list-info">Nenhum material enviado.</div>';
        if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';
        if (docsContainer) docsContainer.innerHTML = '';
    }
}
