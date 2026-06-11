/* =========================================================================
   writer.AI - Frontend Controller & Event Handlers
   ========================================================================= */

// State variables
let currentEnvId = null;
let currentDocId = null;
let environments = [];
let documents = [];
let materials = [];
let saveTimeout = null;
let chatLoading = false;
let agentsListPollInterval = null;

// DOM Elements
const envsContainer = document.getElementById('envs-container');
const docsContainer = document.getElementById('docs-container');
const newEnvBtn = document.getElementById('new-env-btn');
const newDocBtn = document.getElementById('new-doc-btn');
const startEnvBtn = document.getElementById('start-env-btn');
const uploadMaterialBtn = document.getElementById('upload-material-btn');
const activeEnvDisplay = document.getElementById('active-env-display');
const paperEditorContainer = document.getElementById('paper-editor-container');
const noEnvScreen = document.getElementById('no-env-screen');
const docTitleInput = document.getElementById('doc-title-input');
const richEditor = document.getElementById('rich-editor');
const charCount = document.getElementById('char-count');
const wordCount = document.getElementById('word-count');
const saveStatusBtn = document.getElementById('save-status-btn');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const connBadge = document.getElementById('conn-badge');

// Modals
const newEnvModal = document.getElementById('new-env-modal');
const envNameInput = document.getElementById('env-name-input');
const saveNewEnvBtn = document.getElementById('save-new-env-btn');

const uploadMaterialModal = document.getElementById('upload-material-modal');
const uploadMaterialForm = document.getElementById('upload-material-form');
const materialNameInput = document.getElementById('material-name-input');
const materialTypeSelect = document.getElementById('material-type-select');
const materialFileInput = document.getElementById('material-file-input');
const submitUploadBtn = document.getElementById('submit-upload-btn');

// Materials lists
const modelsContainer = document.getElementById('models-container');
const referencesContainer = document.getElementById('references-container');

// Floating Selection state
let lastSelectionRange = null;
let lastSelectedText = '';

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadEnvironments();
    checkConnectionStatus();
    setupEventListeners();
    setupFormattingToolbar();
    setupDragAndDrop();
});

// Setup All Main Event Listeners
function setupEventListeners() {
    // Environment Modal
    newEnvBtn.addEventListener('click', () => openWriterModal('new-env-modal'));
    startEnvBtn.addEventListener('click', () => openWriterModal('new-env-modal'));
    saveNewEnvBtn.addEventListener('click', createEnvironment);

    // Document Creation
    newDocBtn.addEventListener('click', createNewDocument);

    // Materials Modal
    uploadMaterialBtn.addEventListener('click', () => {
        if (!currentEnvId) return;
        document.getElementById('drag-drop-overlay').style.display = 'flex';
    });
    uploadMaterialForm.addEventListener('submit', uploadMaterial);

    // Auto-save on Title & Content changes
    docTitleInput.addEventListener('input', triggerAutoSave);
    richEditor.addEventListener('input', () => {
        updateStats();
        triggerAutoSave();
    });

    // Chat Actions
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    chatSendBtn.addEventListener('click', sendChatMessage);

    // Floating Selection Event Listeners
    richEditor.addEventListener('mouseup', checkTextSelection);
    richEditor.addEventListener('keyup', checkTextSelection);

    document.addEventListener('mousedown', (e) => {
        const popover = document.getElementById('selection-ia-popover');
        if (popover && popover.style.display !== 'none') {
            if (!popover.contains(e.target) && !richEditor.contains(e.target)) {
                hideSelectionPopover();
            }
        }
    });

    const popoverSubmitBtn = document.getElementById('selection-ia-submit');
    const popoverInputEl = document.getElementById('selection-ia-input');
    if (popoverSubmitBtn) {
        popoverSubmitBtn.addEventListener('click', submitSelectionEdit);
    }
    if (popoverInputEl) {
        popoverInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitSelectionEdit();
            }
        });
    }

    // Context Actions
    const editContextBtn = document.getElementById('edit-context-btn');
    if (editContextBtn) {
        editContextBtn.addEventListener('click', () => openWriterModal('edit-context-modal'));
    }
    const editContextForm = document.getElementById('edit-context-form');
    if (editContextForm) {
        editContextForm.addEventListener('submit', saveProductionContext);
    }

    // Agent Actions
    const createAgentBtn = document.getElementById('create-agent-btn');
    if (createAgentBtn) {
        createAgentBtn.addEventListener('click', () => openWriterModal('create-agent-modal'));
    }
    const createAgentForm = document.getElementById('create-agent-form');
    if (createAgentForm) {
        createAgentForm.addEventListener('submit', createAgent);
    }

    // Agent chat Enter key
    const agentChatInput = document.getElementById('agent-chat-input');
    if (agentChatInput) {
        agentChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAgentMessage();
            }
        });
    }

    // Initialize Voice Speech-to-Text
    initSpeechRecognition('chat-mic-btn', 'chat-input');
    initSpeechRecognition('agent-chat-mic-btn', 'agent-chat-input');
    initSpeechRecognition('selection-ia-mic', 'selection-ia-input');
    initSpeechRecognition('agent-name-mic', 'agent-name-input');
    initSpeechRecognition('agent-role-mic', 'agent-role-input');
    initSpeechRecognition('agent-prompt-mic', 'agent-prompt-input');
    initSpeechRecognition('context-name-mic', 'context-name-input');
    initSpeechRecognition('context-text-mic', 'context-text-input');
    initSpeechRecognition('env-name-mic', 'env-name-input');
    initSpeechRecognition('material-name-mic', 'material-name-input');
}

// Check connection and update indicator
async function checkConnectionStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const dot = connBadge.querySelector('.badge-dot');
        const label = connBadge.querySelector('.badge-label');

        if (data.active) {
            dot.className = 'badge-dot active';
            label.textContent = 'IA Conectada Pro';
        } else {
            dot.className = 'badge-dot';
            label.textContent = 'Sem Provedor Ativo';
        }
    } catch (err) {
        console.error('Status check failed:', err);
    }
}

// Load Environments from DB
async function loadEnvironments() {
    try {
        const res = await fetch('/api/writer/environments');
        environments = await res.json();
        renderEnvironments();
    } catch (err) {
        console.error('Error loading environments:', err);
    }
}

// Render Environments in sidebar
function renderEnvironments() {
    envsContainer.innerHTML = '';

    if (environments.length === 0) {
        envsContainer.innerHTML = '<div class="empty-list-info">Nenhum ambiente</div>';
        return;
    }

    environments.forEach(env => {
        const item = document.createElement('div');
        item.className = `env-item ${currentEnvId == env.id ? 'active' : ''}`;
        item.dataset.id = env.id;

        item.innerHTML = `
            <span><i class="fa-solid fa-folder"></i> ${env.name}</span>
            <button class="delete-item-btn" onclick="deleteEnvironment(event, '${env.id}')"><i class="fa-solid fa-trash-can"></i></button>
        `;

        item.addEventListener('click', () => selectEnvironment(env.id, env.name));
        envsContainer.appendChild(item);
    });
}

// Create new Environment
async function createEnvironment() {
    const name = envNameInput.value.trim();
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
            envNameInput.value = '';
            await loadEnvironments();
            selectEnvironment(data.id, data.name);
        } else {
            alert('Erro: ' + data.error);
        }
    } catch (err) {
        console.error('Error creating environment:', err);
    }
}

// Delete Environment
async function deleteEnvironment(event, id) {
    event.stopPropagation();
    if (!confirm('Deseja realmente excluir este ambiente e todos os seus materiais e documentos?')) return;

    try {
        const res = await fetch(`/api/writer/environments/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (currentEnvId == id) {
                currentEnvId = null;
                currentDocId = null;
                updateUILayout();
            }
            loadEnvironments();
        }
    } catch (err) {
        console.error('Error deleting environment:', err);
    }
}

// Delete Document
async function deleteDocument(event, id) {
    event.stopPropagation();
    if (!confirm('Deseja realmente excluir este documento?')) return;

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/documents/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (currentDocId == id) {
                currentDocId = null;
                // Clear editor contents
                docTitleInput.value = '';
                richEditor.innerHTML = '';
                updateStats();
            }
            await loadDocuments();
            // If there are documents left, select the first one, otherwise show empty editor
            if (documents.length > 0) {
                selectDocument(documents[0].id, documents[0].title, documents[0].content);
            }
        }
    } catch (err) {
        console.error('Error deleting document:', err);
    }
}

// Select writing environment
async function selectEnvironment(id, name) {
    currentEnvId = id;
    currentDocId = null;
    activeEnvDisplay.textContent = name;

    // Enable/disable buttons
    newDocBtn.disabled = false;
    uploadMaterialBtn.disabled = false;
    chatSendBtn.disabled = false;
    const editContextBtn = document.getElementById('edit-context-btn');
    if (editContextBtn) editContextBtn.disabled = false;
    const createAgentBtn = document.getElementById('create-agent-btn');
    if (createAgentBtn) createAgentBtn.disabled = false;

    // Visual toggle
    document.querySelectorAll('.env-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.env-item[data-id="${id}"]`);
    if (activeEl) activeEl.classList.add('active');

    updateUILayout();

    // Load environment documents, materials, messages, and production context
    await loadDocuments();
    await loadMaterials();
    await loadChatMessages();
    await loadProductionContext();
    await loadAgents();

    // Start background polling for agent statuses and main chat notifications
    if (agentsListPollInterval) clearInterval(agentsListPollInterval);
    agentsListPollInterval = setInterval(async () => {
        if (currentEnvId) {
            await loadAgents();
            await loadChatMessages();
        }
    }, 5000);

    // Select first doc by default if exists, otherwise create first doc
    if (documents.length > 0) {
        selectDocument(documents[0].id, documents[0].title, documents[0].content);
    } else {
        createNewDocument();
    }
}

// Update Layout according to environment state
function updateUILayout() {
    if (currentEnvId) {
        noEnvScreen.style.display = 'none';
        paperEditorContainer.style.display = 'flex';
        document.getElementById('text-toolbar').style.visibility = 'visible';
    } else {
        noEnvScreen.style.display = 'flex';
        paperEditorContainer.style.display = 'none';
        document.getElementById('text-toolbar').style.visibility = 'hidden';
        activeEnvDisplay.textContent = 'Selecione um Ambiente';
        newDocBtn.disabled = true;
        uploadMaterialBtn.disabled = true;
        chatSendBtn.disabled = true;

        const editContextBtn = document.getElementById('edit-context-btn');
        if (editContextBtn) editContextBtn.disabled = true;
        const contextContainer = document.getElementById('context-display-container');
        if (contextContainer) {
            contextContainer.innerHTML = '<div class="empty-list-info">Selecione um ambiente para ver o contexto.</div>';
        }

        modelsContainer.innerHTML = '<div class="empty-list-info">Nenhum modelo enviado.</div>';
        referencesContainer.innerHTML = '<div class="empty-list-info">Nenhum material enviado.</div>';
        chatMessagesContainer.innerHTML = '';
        docsContainer.innerHTML = '';
    }
}

// Load Documents
async function loadDocuments() {
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/documents`);
        documents = await res.json();
        renderDocuments();
    } catch (err) {
        console.error('Error loading documents:', err);
    }
}

// Render Documents List
function renderDocuments() {
    docsContainer.innerHTML = '';
    if (documents.length === 0) {
        docsContainer.innerHTML = '<div class="empty-list-info">Nenhum texto</div>';
        return;
    }

    documents.forEach(doc => {
        const item = document.createElement('div');
        item.className = `doc-item ${currentDocId == doc.id ? 'active' : ''}`;
        item.dataset.id = doc.id;

        item.innerHTML = `
            <span><i class="fa-regular fa-file-lines"></i> ${doc.title}</span>
            <button class="delete-item-btn" onclick="deleteDocument(event, '${doc.id}')"><i class="fa-solid fa-trash-can"></i></button>
        `;

        item.addEventListener('click', () => selectDocument(doc.id, doc.title, doc.content));
        docsContainer.appendChild(item);
    });
}

// Create New Document
async function createNewDocument() {
    if (!currentEnvId) return;

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Sem título',
                content: ''
            })
        });
        const data = await res.json();
        if (data.success) {
            await loadDocuments();
            selectDocument(data.id, 'Sem título', '');
        }
    } catch (err) {
        console.error('Error creating document:', err);
    }
}

// Select and open Document
function selectDocument(id, title, content) {
    currentDocId = id;

    // Toggle active document highlight
    document.querySelectorAll('.doc-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.doc-item[data-id="${id}"]`);
    if (activeEl) activeEl.classList.add('active');

    // Load contents to editor
    // Strip out hallucinated boilerplate tags (style, html, body) if present
    function sanitizeEditorHtml(htmlStr) {
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

    docTitleInput.value = title === 'Sem título' ? '' : title;
    richEditor.innerHTML = sanitizeEditorHtml(content || '');

    updateStats();
    setSaveStatus("saved");
}

// Auto save with Debouncing
function triggerAutoSave() {
    if (!currentEnvId || !currentDocId) return;

    if (saveTimeout) clearTimeout(saveTimeout);
    setSaveStatus("saving");

    saveTimeout = setTimeout(saveCurrentDocument, 1200);
}

// Save document details
async function saveCurrentDocument() {
    if (!currentEnvId || !currentDocId) return;

    const title = docTitleInput.value.trim() || 'Sem título';
    const content = richEditor.innerHTML;

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentDocId,
                title,
                content
            })
        });
        const data = await res.json();
        if (data.success) {
            setSaveStatus("saved");
            // Update item title in sidebar without reloading
            const activeEl = document.querySelector(`.doc-item[data-id="${currentDocId}"] span`);
            if (activeEl) activeEl.innerHTML = `<i class="fa-regular fa-file-lines"></i> ${title}`;
        }
    } catch (err) {
        console.error('Error saving document:', err);
        setSaveStatus("error");
    }
}

// Update Editor Saved/Saving Status indicator
function setSaveStatus(status) {
    if (status === "saving") {
        saveStatusBtn.className = "save-indicator saving";
        saveStatusBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
    } else if (status === "saved") {
        saveStatusBtn.className = "save-indicator";
        saveStatusBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Salvo`;
    } else {
        saveStatusBtn.className = "save-indicator error";
        saveStatusBtn.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Erro ao Salvar`;
    }
}

// Character & Word counter updater
function updateStats() {
    const text = richEditor.innerText || richEditor.textContent || '';
    const charLen = text.length;
    const cleanText = text.trim().replace(/\s+/g, ' ');
    const wordLen = cleanText === '' ? 0 : cleanText.split(' ').length;

    charCount.textContent = `${charLen} ${charLen === 1 ? 'caractere' : 'caracteres'}`;
    wordCount.textContent = `${wordLen} ${wordLen === 1 ? 'palavra' : 'palavras'}`;
}

// Setup Rich-Text Page formatting actions
function setupFormattingToolbar() {
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.val || null;
            document.execCommand(cmd, false, val);
            richEditor.focus();
        });
    });
}

// Load Materials (Reference & Models)
async function loadMaterials() {
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/materials`);
        materials = await res.json();
        renderMaterials();
    } catch (err) {
        console.error('Error loading materials:', err);
    }
}

// Render materials list into separate tabs
function renderMaterials() {
    const modelsList = materials.filter(m => m.material_type === 'model');
    const referencesList = materials.filter(m => m.material_type === 'reference');

    // Render Models
    modelsContainer.innerHTML = '';
    if (modelsList.length === 0) {
        modelsContainer.innerHTML = '<div class="empty-list-info">Nenhum modelo enviado.</div>';
    } else {
        modelsList.forEach(m => {
            const item = document.createElement('div');
            item.className = 'material-item';
            item.innerHTML = `
                <span style="cursor: pointer; display: flex; align-items: center; gap: 8px;" onclick="openCitationModal('${m.id}', null, null)"><i class="fa-solid fa-file-pdf material-icon"></i> ${m.name}</span>
                <button class="delete-item-btn" onclick="deleteMaterial(event, '${m.id}')"><i class="fa-solid fa-trash-can"></i></button>
            `;
            modelsContainer.appendChild(item);
        });
    }

    // Render References
    referencesContainer.innerHTML = '';
    if (referencesList.length === 0) {
        referencesContainer.innerHTML = '<div class="empty-list-info">Nenhum material enviado.</div>';
    } else {
        referencesList.forEach(m => {
            const item = document.createElement('div');
            item.className = 'material-item';
            item.innerHTML = `
                <span style="cursor: pointer; display: flex; align-items: center; gap: 8px;" onclick="openCitationModal('${m.id}', null, null)"><i class="fa-solid fa-file-pdf material-icon"></i> ${m.name}</span>
                <button class="delete-item-btn" onclick="deleteMaterial(event, '${m.id}')"><i class="fa-solid fa-trash-can"></i></button>
            `;
            referencesContainer.appendChild(item);
        });
    }
}

// Upload PDF/text file material
async function uploadMaterial(e) {
    e.preventDefault();
    if (!currentEnvId) return;

    console.log("Starting upload for env:", currentEnvId);
    submitUploadBtn.disabled = true;
    submitUploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    const formData = new FormData(uploadMaterialForm);
    console.log("FormData created", formData.get('name'), formData.get('file'));

    try {
        console.log("Sending fetch to:", `/api/writer/environments/${currentEnvId}/materials`);
        const res = await fetch(`/api/writer/environments/${currentEnvId}/materials`, {
            method: 'POST',
            body: formData
        });
        console.log("Fetch response status:", res.status);
        const data = await res.json();
        console.log("Fetch response data:", data);

        if (data.success) {
            closeWriterModal('upload-material-modal');
            uploadMaterialForm.reset();
            loadMaterials();
        } else {
            alert('Erro no envio: ' + data.error);
        }
    } catch (err) {
        console.error('Error uploading material:', err);
    } finally {
        submitUploadBtn.disabled = false;
        submitUploadBtn.innerHTML = 'Enviar Material';
    }
}

// Delete Reference/Model Material
async function deleteMaterial(event, id) {
    event.stopPropagation();
    if (!confirm('Deseja excluir este material de apoio do ambiente?')) return;

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/materials/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            loadMaterials();
        }
    } catch (err) {
        console.error('Error deleting material:', err);
    }
}

// Switch between Material Sub-panel tabs
window.switchMaterialTab = function (btn, tabId) {
    document.querySelectorAll('.material-tab-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.material-tab-pane').forEach(el => el.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(tabId).classList.add('active');
};

// Load Chat Messages
async function loadChatMessages() {
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/messages`);
        const msgs = await res.json();
        renderChatMessages(msgs);
    } catch (err) {
        console.error('Error loading chat messages:', err);
    }
}

// Render messages
function renderChatMessages(msgs) {
    chatMessagesContainer.innerHTML = '';

    if (msgs.length === 0) {
        chatMessagesContainer.innerHTML = `
            <div class="chat-bubble ai">
                <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="chat-text">
                    <p>Olá! Sou o seu assistente de escrita inteligente. Envie materiais de apoio e diga o que você deseja escrever para começarmos a colaborar juntos!</p>
                </div>
            </div>
        `;
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
                
                proposalHtml = `
                    <div class="proposed-change-card" style="margin-top: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(168,85,247,0.25); border-radius: 10px; padding: 12px;">
                        <div style="font-size:0.75rem; font-weight:600; color:#d8b4fe; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-file-pen"></i> Alterações Propostas em: <strong>${payload.proposal.document_title}</strong>
                        </div>
                        <div class="diff-container">
                            ${diffLinesHtml || '<div style="color: var(--text-muted); font-style: italic; padding: 4px;">Nenhuma alteração textual detectada.</div>'}
                        </div>
                        <div style="display:flex; justify-content:flex-end;">
                            <button class="approve-proposal-btn" onclick="applyProposedChange(this, '${payload.proposal.document_id}', '${base64Content}')">
                                <i class="fa-solid fa-circle-check"></i> Aprovar e Aplicar Alterações
                            </button>
                        </div>
                    </div>
                `;
            }
        } else {
            formattedMsg = formatMarkdownSimple(m.message);
        }

        let actionsHtml = '';
        if (m.sender === 'ai' && !proposalHtml) {
            actionsHtml = `
                <div class="chat-bubble-actions" style="display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end;">
                    <button class="chat-action-btn" onclick="applyChatToEditor(this)" style="background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); color: #d8b4fe; padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-file-import"></i> Aplicar no Editor</button>
                </div>
            `;
        }

        bubble.innerHTML = `
            <div class="chat-avatar">${avatar}</div>
            <div class="chat-text">
                <div>${formattedMsg}</div>
                ${proposalHtml}
                ${actionsHtml}
            </div>
        `;

        chatMessagesContainer.appendChild(bubble);
    });

    scrollToBottom();
}

// Send user message
async function sendChatMessage() {
    if (!currentEnvId || chatLoading) return;

    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = '';
    chatInput.style.height = '32px';
    chatLoading = true;
    chatSendBtn.disabled = true;

    // Add User bubble instantly
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.innerHTML = `
        <div class="chat-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="chat-text"><p>${message.replace(/\n/g, '<br>')}</p></div>
    `;
    chatMessagesContainer.appendChild(userBubble);
    scrollToBottom();

    // Add AI temporary loading bubble
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'chat-bubble ai loading-bubble';
    loadingBubble.innerHTML = `
        <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="chat-text">
            <div class="chat-loading">
                <div></div>
                <div></div>
                <div></div>
            </div>
        </div>
    `;
    chatMessagesContainer.appendChild(loadingBubble);
    scrollToBottom();

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, active_doc_id: currentDocId })
        });
        const data = await res.json();

        // Remove loading
        const lb = chatMessagesContainer.querySelector('.loading-bubble');
        if (lb) lb.remove();

        if (data.success) {
            // Refresh agents list in case an agent was created or updated
            loadAgents();
            // Render AI bubble
            const aiBubble = document.createElement('div');
            aiBubble.className = 'chat-bubble ai';

            const actionsHtml = `
                <div class="chat-bubble-actions" style="display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end;">
                    <button class="chat-action-btn" onclick="applyChatToEditor(this)" style="background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); color: #d8b4fe; padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-file-import"></i> Aplicar no Editor</button>
                </div>
            `;

            aiBubble.innerHTML = `
                <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="chat-text">
                    <div>${formatMarkdownSimple(data.message)}</div>
                    ${actionsHtml}
                </div>
            `;
            chatMessagesContainer.appendChild(aiBubble);

            // Apply document update if available
            if (data.document_update !== null && data.document_update !== undefined) {
                // Store previous state and show review overlay
                window.previousEditorContent = richEditor.innerHTML;
                
                // Strip out hallucinated boilerplate tags (style, html, body) if present
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = data.document_update;
                tempDiv.querySelectorAll('style, script, head, meta, link, title').forEach(el => el.remove());
                let clean = tempDiv.innerHTML;
                clean = clean.replace(/<!DOCTYPE[^>]*>/gi, '');
                clean = clean.replace(/<html[^>]*>/gi, '');
                clean = clean.replace(/<\/html>/gi, '');
                clean = clean.replace(/<body[^>]*>/gi, '');
                clean = clean.replace(/<\/body>/gi, '');
                
                richEditor.innerHTML = clean;
                updateStats();
                setSaveStatus("unsaved");

                // Visual feedback of change: quick yellow highlight flash
                richEditor.style.transition = 'none';
                richEditor.style.backgroundColor = 'rgba(253, 224, 71, 0.2)';
                setTimeout(() => {
                    richEditor.style.transition = 'background-color 0.8s ease';
                    richEditor.style.backgroundColor = 'transparent';
                }, 100);
                
                // Show review overlay
                const overlay = document.getElementById('ai-review-overlay');
                if (overlay) overlay.style.display = 'block';
            }
        } else {
            alert('Falha na resposta: ' + data.error);
        }
    } catch (err) {
        console.error('Error sending message:', err);
        const lb = chatMessagesContainer.querySelector('.loading-bubble');
        if (lb) lb.remove();
    } finally {
        chatLoading = false;
        chatSendBtn.disabled = false;
        scrollToBottom();
    }
}

// Review AI Changes Functions
window.acceptAiChanges = function() {
    const overlay = document.getElementById('ai-review-overlay');
    if (overlay) overlay.style.display = 'none';
    
    // Save to server
    saveDocument();
};

window.rejectAiChanges = function() {
    const overlay = document.getElementById('ai-review-overlay');
    if (overlay) overlay.style.display = 'none';
    
    // Revert content
    if (window.previousEditorContent !== undefined) {
        richEditor.innerHTML = window.previousEditorContent;
        updateStats();
        setSaveStatus("saved");
    }
};

// Auto-scroll chat window
function scrollToBottom() {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Simple client-side Markdown formatting parser
function formatMarkdownSimple(text) {
    if (!text) return '';
    let html = text;

    // Escape standard HTML tags safely
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([\s\S]+?)```/g, (match, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Paragraph lists/line breaks
    html = html.split('\n\n').map(p => {
        p = p.trim();
        if (p.startsWith('- ') || p.startsWith('* ')) {
            const listItems = p.split(/\n[-*]\s/).map(li => {
                let liText = li.replace(/^[-*]\s/, '');
                
                // Parse visual tags for academic correctness review
                if (liText.includes('[CORRETO]') || liText.includes('[CORRECT]')) {
                    liText = liText.replace('[CORRETO]', '').replace('[CORRECT]', '');
                    return `<li class="correct-highlight" style="list-style-type: none; margin-left: -20px;"><i class="fa-solid fa-circle-check" style="color: #22c55e; margin-right: 6px;"></i>${liText}</li>`;
                }
                if (liText.includes('[INCORRETO]') || liText.includes('[INCORRECT]')) {
                    liText = liText.replace('[INCORRETO]', '').replace('[INCORRECT]', '');
                    return `<li class="incorrect-highlight" style="list-style-type: none; margin-left: -20px;"><i class="fa-solid fa-circle-xmark" style="color: #ef4444; margin-right: 6px;"></i>${liText}</li>`;
                }
                
                return `<li>${liText}</li>`;
            }).join('');
            return `<ul>${listItems}</ul>`;
        }
        
        // Handle standalone text blocks with tags
        if (p.includes('[CORRETO]') || p.includes('[CORRECT]')) {
            let cleanP = p.replace('[CORRETO]', '').replace('[CORRECT]', '');
            return `<div class="correct-highlight"><i class="fa-solid fa-circle-check" style="color: #22c55e; margin-right: 6px;"></i><strong>Correto:</strong> ${cleanP}</div>`;
        }
        if (p.includes('[INCORRETO]') || p.includes('[INCORRECT]')) {
            let cleanP = p.replace('[INCORRETO]', '').replace('[INCORRECT]', '');
            return `<div class="incorrect-highlight"><i class="fa-solid fa-circle-xmark" style="color: #ef4444; margin-right: 6px;"></i><strong>Ajustar:</strong> ${cleanP}</div>`;
        }
        
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
}

// Modal Toggle Helpers
window.openWriterModal = function (id) {
    document.getElementById(id).classList.add('active');
};

window.closeWriterModal = function (id) {
    document.getElementById(id).classList.remove('active');
};

// Expand input textareas as user types
chatInput.addEventListener('input', function () {
    this.style.height = '32px';
    const newHeight = Math.min(this.scrollHeight, 80);
    this.style.height = newHeight + 'px';
});

// Floating Selection Handlers
function checkTextSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();

    if (text.length > 0 && richEditor.contains(range.commonAncestorContainer)) {
        lastSelectionRange = range.cloneRange();
        lastSelectedText = text;
        showSelectionPopover(range);
    }
}

function showSelectionPopover(range) {
    const popover = document.getElementById('selection-ia-popover');
    if (!popover) return;

    popover.style.display = 'block';

    const rect = range.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth;
    const popoverHeight = popover.offsetHeight;

    // Position the popover centered above the selection bounds
    const topPos = rect.top + window.scrollY - popoverHeight - 10;
    const leftPos = rect.left + window.scrollX + (rect.width / 2) - (popoverWidth / 2);

    popover.style.top = `${Math.max(10, topPos)}px`;
    popover.style.left = `${Math.max(10, leftPos)}px`;

    const input = document.getElementById('selection-ia-input');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function hideSelectionPopover() {
    const popover = document.getElementById('selection-ia-popover');
    if (popover) {
        popover.style.display = 'none';
    }
    lastSelectionRange = null;
    lastSelectedText = '';
}

async function submitSelectionEdit() {
    const input = document.getElementById('selection-ia-input');
    const submitBtn = document.getElementById('selection-ia-submit');
    if (!input || !submitBtn || !lastSelectedText || !lastSelectionRange || !currentEnvId) return;

    const message = input.value.trim();
    if (!message) return;

    // Show loading state in popover
    input.disabled = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner popover-loading-spinner"></i>';

    // Append user message to the chat sidebar as usual
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.innerHTML = `
        <div class="chat-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="chat-text"><p>${message.replace(/\n/g, '<br>')}</p></div>
    `;
    chatMessagesContainer.appendChild(userBubble);
    scrollToBottom();

    // Add AI loading bubble to chat sidebar
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'chat-bubble ai loading-bubble';
    loadingBubble.innerHTML = `
        <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="chat-text">
            <div class="chat-loading">
                <div></div>
                <div></div>
                <div></div>
            </div>
        </div>
    `;
    chatMessagesContainer.appendChild(loadingBubble);
    scrollToBottom();

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                active_doc_id: currentDocId,
                selected_text: lastSelectedText
            })
        });
        const data = await res.json();

        // Remove loading bubble from chat
        const lb = chatMessagesContainer.querySelector('.loading-bubble');
        if (lb) lb.remove();

        if (data.success) {
            // Add AI response bubble to chat sidebar
            const aiBubble = document.createElement('div');
            aiBubble.className = 'chat-bubble ai';

            const actionsHtml = `
                <div class="chat-bubble-actions" style="display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end;">
                    <button class="chat-action-btn" onclick="applyChatToEditor(this)" style="background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); color: #d8b4fe; padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-file-import"></i> Aplicar no Editor</button>
                </div>
            `;

            aiBubble.innerHTML = `
                <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="chat-text">
                    <div>${formatMarkdownSimple(data.message)}</div>
                    ${actionsHtml}
                </div>
            `;
            chatMessagesContainer.appendChild(aiBubble);
            scrollToBottom();

            // Apply selection update in the editor range
            if (data.selection_update !== null && data.selection_update !== undefined) {
                // Restore selection range
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(lastSelectionRange);

                lastSelectionRange.deleteContents();

                const el = document.createElement("span");
                el.innerHTML = data.selection_update;

                // Highlight change with neon purple-glow briefly
                el.style.backgroundColor = 'rgba(168, 85, 247, 0.25)';
                el.style.transition = 'background-color 0.8s ease';
                el.style.borderRadius = '4px';
                el.style.padding = '2px 4px';

                lastSelectionRange.insertNode(el);
                selection.removeAllRanges();

                // Save document change to DB immediately
                saveCurrentDocument();

                setTimeout(() => {
                    el.style.backgroundColor = 'transparent';
                    setTimeout(() => {
                        const parent = el.parentNode;
                        if (parent) {
                            while (el.firstChild) {
                                parent.insertBefore(el.firstChild, el);
                            }
                            parent.removeChild(el);
                        }
                        richEditor.normalize();
                    }, 800);
                }, 500);
            }
        } else {
            alert('Falha na resposta: ' + data.error);
        }
    } catch (err) {
        console.error('Error sending selection edit:', err);
    } finally {
        // Reset popover input state
        input.disabled = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        hideSelectionPopover();
    }
}

async function loadProductionContext() {
    if (!currentEnvId) return;
    const container = document.getElementById('context-display-container');
    if (!container) return;

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/contexts`);
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
                <button class="delete-item-btn" onclick="deleteProductionContext(event, '${ctx.id}')"><i class="fa-solid fa-trash-can"></i></button>
            `;
            container.appendChild(item);
        });
    } catch (err) {
        console.error('Error loading production contexts:', err);
        container.innerHTML = `<div class="empty-list-info">Erro ao carregar contexto.</div>`;
    }
}

async function saveProductionContext(event) {
    if (event) event.preventDefault();
    if (!currentEnvId) return;

    const submitBtn = document.getElementById('submit-context-btn');
    const form = document.getElementById('edit-context-form');
    const nameInput = document.getElementById('context-name-input');
    const fileInput = document.getElementById('context-file-input');
    const textInput = document.getElementById('context-text-input');

    if (!form || !submitBtn) return;

    const name = nameInput ? nameInput.value.trim() : '';
    const textContent = textInput ? textInput.value.trim() : '';
    const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

    if (!name && !file) {
        alert('Por favor, informe o nome do contexto ou envie um arquivo.');
        return;
    }
    if (!textContent && !file) {
        alert('Por favor, informe o texto do contexto ou envie um arquivo.');
        return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('text_content', textContent);
    if (file) {
        formData.append('file', file);
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/contexts`, {
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

async function deleteProductionContext(event, id) {
    event.stopPropagation();
    if (!confirm('Deseja realmente excluir este item de contexto de produção?')) return;

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/contexts/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            await loadProductionContext();
        }
    } catch (err) {
        console.error('Error deleting production context:', err);
    }
}

window.deleteProductionContext = deleteProductionContext;

// ─── AGENTS MANAGEMENT ────────────────────────────────────────────────────────

let currentAgentId = null;
let currentAgentName = 'Agente';

// Toast System
function showToast(title, body, onClickCallback) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-card';
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fa-solid fa-robot"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-body">${body}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;

    toast.addEventListener('click', (e) => {
        if (e.target.classList.contains('toast-close')) {
            return;
        }
        if (onClickCallback) {
            onClickCallback();
        }
        removeToast(toast);
    });

    toast.querySelector('.toast-close').addEventListener('click', (e) => {
        e.stopPropagation();
        removeToast(toast);
    });

    container.appendChild(toast);

    setTimeout(() => {
        removeToast(toast);
    }, 6000);
}

function removeToast(toast) {
    if (toast.classList.contains('toast-fadeOut')) return;
    toast.classList.add('toast-fadeOut');
    setTimeout(() => {
        toast.remove();
    }, 350);
}

async function loadAgents() {
    if (!currentEnvId) return;
    const container = document.getElementById('agents-list-container');
    if (!container) return;
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/agents`);
        const agents = await res.json();
        
        // Track state transitions to show toasts
        if (window.previousAgentsState) {
            agents.forEach(newAgent => {
                const oldAgent = window.previousAgentsState.find(a => a.id === newAgent.id);
                if (oldAgent) {
                    if (oldAgent.status === 'working' && newAgent.status === 'idle') {
                        const lastMsgSnippet = newAgent.last_message ? (newAgent.last_message.substring(0, 80) + '...') : 'Relatório concluído.';
                        showToast(
                            `🤖 ${newAgent.name} Concluído!`,
                            lastMsgSnippet,
                            () => {
                                openAgentChat(newAgent.id, newAgent.name, newAgent.role);
                            }
                        );
                    }
                }
            });
        }
        window.previousAgentsState = agents;

        renderAgents(agents);
    } catch (err) {
        console.error('Error loading agents:', err);
    }
}

function renderAgents(agents) {
    const container = document.getElementById('agents-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (!agents || agents.length === 0) {
        container.innerHTML = '<div class="empty-list-info">Nenhum agente criado. Clique em <strong>+ Novo Agente</strong> para criar.</div>';
        return;
    }

    agents.forEach(agent => {
        const item = document.createElement('div');
        item.className = `agent-item${agent.is_leader ? ' leader' : ''}`;
        
        let statusHtml = '';
        if (agent.status === 'working') {
            statusHtml = `
                <div class="agent-working-badge" style="display:flex; align-items:center; gap:4px; font-size:0.7rem; color:var(--accent-purple); margin-top:2.5px; font-weight:500;">
                    <i class="fa-solid fa-gear fa-spin"></i> Em segundo plano...
                </div>
            `;
        } else if (agent.last_message && agent.last_message_sender === 'ai') {
            const truncated = agent.last_message.length > 42 ? agent.last_message.substring(0, 42) + '...' : agent.last_message;
            statusHtml = `
                <div class="agent-last-msg" style="font-size:0.7rem; color:var(--text-muted); margin-top:2.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 175px;" title="${agent.last_message.replace(/"/g, '&quot;')}">
                    <i class="fa-solid fa-check" style="color:var(--accent-pink); font-size:0.65rem;"></i> ${truncated}
                </div>
            `;
        }

        item.innerHTML = `
            <div class="agent-item-info" style="flex:1; min-width:0; padding-right:8px;" onclick="openAgentChat('${agent.id}', '${agent.name.replace(/'/g,"\\'")}', '${(agent.role||'').replace(/'/g,"\\'")}')">
                <div class="agent-item-name" style="display:flex; align-items:center; gap:6px; font-weight:600; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    <i class="fa-solid fa-robot" style="font-size:0.8rem; color:${agent.is_leader ? 'var(--accent-pink)' : 'var(--accent-purple)'}; flex-shrink:0;"></i>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${agent.name}</span>
                    ${agent.is_leader ? '<span class="agent-badge" style="flex-shrink:0;">Líder</span>' : ''}
                </div>
                <div class="agent-item-role" style="font-size:0.72rem; color:var(--text-muted); margin-top:1px;">${agent.role || 'sub-agente'}</div>
                ${statusHtml}
            </div>
            <div class="agent-actions" style="flex-shrink:0; display:flex; gap:4px; align-items:center;">
                <button class="agent-action-btn" title="Resetar conversa" onclick="resetAgent(event, '${agent.id}')">
                    <i class="fa-solid fa-arrow-rotate-left"></i>
                </button>
                ${!agent.is_leader ? `<button class="agent-action-btn danger" title="Excluir agente" onclick="deleteAgent(event, '${agent.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>` : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

async function createAgent(event) {
    event.preventDefault();
    const nameInput = document.getElementById('agent-name-input');
    const roleInput = document.getElementById('agent-role-input');
    const promptInput = document.getElementById('agent-prompt-input');
    const submitBtn = document.getElementById('submit-agent-btn');

    const name = nameInput.value.trim();
    const role = roleInput.value.trim() || 'sub-agente';
    const system_prompt = promptInput.value.trim();

    if (!name) { alert('Informe o nome do agente.'); return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, role, system_prompt, is_leader: false })
        });
        const data = await res.json();
        if (data.success) {
            closeWriterModal('create-agent-modal');
            nameInput.value = '';
            roleInput.value = '';
            promptInput.value = '';
            await loadAgents();
        } else {
            alert('Erro ao criar agente: ' + (data.error || 'Erro desconhecido'));
        }
    } catch (err) {
        console.error('Error creating agent:', err);
        alert('Erro de rede ao criar agente.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-robot"></i> Criar Agente';
    }
}

async function deleteAgent(event, agentId) {
    event.stopPropagation();
    if (!confirm('Excluir este agente e toda a sua conversa? Esta ação é irreversível.')) return;
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/agents/${agentId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (currentAgentId === agentId) closeWriterModal('agent-chat-modal');
            await loadAgents();
        } else {
            alert(data.error || 'Erro ao excluir agente.');
        }
    } catch (err) { console.error('Error deleting agent:', err); }
}

async function resetAgent(event, agentId) {
    event.stopPropagation();
    if (!confirm('Resetar a conversa com este agente? Todo o histórico será apagado.')) return;
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/agents/${agentId}/reset`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            if (currentAgentId === agentId) {
                document.getElementById('agent-chat-messages').innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.82rem;">Conversa resetada. Diga algo para começar!</div>';
            }
        }
    } catch (err) { console.error('Error resetting agent:', err); }
}

async function openAgentChat(agentId, agentName, agentRole) {
    currentAgentId = agentId;
    currentAgentName = agentName;
    document.getElementById('agent-chat-modal-title').textContent = agentName;
    document.getElementById('agent-chat-modal-role').textContent = agentRole || 'sub-agente';

    const messagesEl = document.getElementById('agent-chat-messages');
    messagesEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    openWriterModal('agent-chat-modal');

    let msgs = [];
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/agents/${agentId}/messages`);
        msgs = await res.json();
        renderAgentMessages(msgs);
    } catch (err) {
        console.error('Error loading agent messages:', err);
        messagesEl.innerHTML = '<div style="color:var(--accent-pink);text-align:center;padding:20px;">Erro ao carregar histórico.</div>';
    }

    const input = document.getElementById('agent-chat-input');
    const sendBtn = document.getElementById('agent-chat-send-btn');
    if (input) {
        input.placeholder = `Atribua uma tarefa a ${agentName}...`;
        input.focus();
    }

    if (msgs.length > 0 && msgs[msgs.length - 1].sender === 'user') {
        if (input && sendBtn) {
            input.disabled = true;
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fa-solid fa-hourglass-half fa-spin"></i>';
        }

        const aiMsgsBefore = msgs.filter(m => m.sender === 'ai').length;
        if (agentPollInterval) clearInterval(agentPollInterval);
        agentPollInterval = setInterval(async () => {
            if (currentAgentId !== agentId) {
                clearInterval(agentPollInterval);
                agentPollInterval = null;
                return;
            }
            try {
                const pollRes = await fetch(`/api/writer/environments/${currentEnvId}/agents/${agentId}/last`);
                const pollData = await pollRes.json();
                if (pollData.done) {
                    const res2 = await fetch(`/api/writer/environments/${currentEnvId}/agents/${agentId}/messages`);
                    const msgs2 = await res2.json();
                    const newCount = msgs2.filter(m => m.sender === 'ai').length;
                    if (newCount > aiMsgsBefore) {
                        clearInterval(agentPollInterval);
                        agentPollInterval = null;
                        renderAgentMessages(msgs2);
                        if (input && sendBtn) {
                            input.disabled = false;
                            sendBtn.disabled = false;
                            sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
                        }
                        await loadAgents();
                    }
                }
            } catch (e) {}
        }, 2500);
    } else {
        if (input && sendBtn) {
            input.disabled = false;
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        }
    }
}

function parseAgentMessagePayload(msgStr) {
    if (!msgStr) return { report: '', proposal: null };
    const trimmed = msgStr.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object') {
                return {
                    report: parsed.report || '',
                    proposal: parsed.proposal || null
                };
            }
        } catch (e) {
            // Not valid JSON
        }
    }
    return { report: msgStr, proposal: null };
}

window.applyProposedChange = async function (btn, documentId, base64Content) {
    // Close the subagent chat modal if it is active
    const agentModal = document.getElementById('agent-chat-modal');
    if (agentModal && agentModal.classList.contains('active')) {
        closeWriterModal('agent-chat-modal');
    }
    
    // Put application request message in main chat input
    if (chatInput) {
        chatInput.value = "Por favor, aplique as alterações propostas pelo subagente para o documento.";
        
        // Trigger main chat submission
        await sendChatMessage();
    }
};

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateLineDiff(originalHtml, proposedHtml) {
    function htmlToText(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const blocks = temp.querySelectorAll('p, div, br, li, h1, h2, h3, h4');
        blocks.forEach(b => {
            if (b.tagName === 'BR') {
                b.replaceWith('\n');
            } else {
                b.after('\n');
            }
        });
        return temp.textContent.trim();
    }

    const origText = htmlToText(originalHtml);
    const propText = htmlToText(proposedHtml);

    const origLines = origText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const propLines = propText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let diffHtml = '';
    let i = 0, j = 0;
    while (i < origLines.length || j < propLines.length) {
        if (i < origLines.length && j < propLines.length && origLines[i] === propLines[j]) {
            diffHtml += `<div class="diff-line unchanged">  ${escapeHtml(origLines[i])}</div>`;
            i++;
            j++;
        } else {
            // Look ahead for matches
            let foundInProp = -1;
            for (let k = j; k < Math.min(j + 8, propLines.length); k++) {
                if (origLines[i] === propLines[k]) {
                    foundInProp = k;
                    break;
                }
            }
            
            if (foundInProp !== -1) {
                for (let k = j; k < foundInProp; k++) {
                    diffHtml += `<div class="diff-line addition">+ ${escapeHtml(propLines[k])}</div>`;
                }
                j = foundInProp;
            } else {
                let foundInOrig = -1;
                for (let k = i; k < Math.min(i + 8, origLines.length); k++) {
                    if (propLines[j] === origLines[k]) {
                        foundInOrig = k;
                        break;
                    }
                }
                
                if (foundInOrig !== -1) {
                    for (let k = i; k < foundInOrig; k++) {
                        diffHtml += `<div class="diff-line deletion">- ${escapeHtml(origLines[k])}</div>`;
                    }
                    i = foundInOrig;
                } else {
                    if (i < origLines.length) {
                        diffHtml += `<div class="diff-line deletion">- ${escapeHtml(origLines[i])}</div>`;
                        i++;
                    }
                    if (j < propLines.length) {
                        diffHtml += `<div class="diff-line addition">+ ${escapeHtml(propLines[j])}</div>`;
                        j++;
                    }
                }
            }
        }
    }
    return diffHtml;
}

function renderAgentMessages(msgs) {
    const el = document.getElementById('agent-chat-messages');
    if (!el) return;
    if (!msgs || msgs.length === 0) {
        el.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.82rem;"><i class="fa-solid fa-inbox" style="font-size:1.5rem; margin-bottom:8px; display:block; opacity:0.4;"></i>Nenhuma tarefa atribuída ainda.<br><span style="opacity:0.6;">Digite uma tarefa abaixo e o agente irá executá-la em segundo plano.</span></div>`;
        return;
    }

    const pairs = [];
    let i = 0;
    while (i < msgs.length) {
        const task = msgs[i];
        const report = msgs[i + 1] && msgs[i + 1].sender === 'ai' ? msgs[i + 1] : null;
        pairs.push({ task, report });
        i += report ? 2 : 1;
    }

    el.innerHTML = pairs.map(({ task, report }) => {
        let reportHtml = '';
        if (report) {
            const payload = parseAgentMessagePayload(report.message);
            const formattedReport = formatMarkdownSimple(payload.report);
            
            let proposalHtml = '';
            if (payload.proposal) {
                const base64Content = btoa(unescape(encodeURIComponent(payload.proposal.content)));
                const diffLinesHtml = generateLineDiff(payload.proposal.original_content || '', payload.proposal.content || '');
                
                proposalHtml = `
                    <div class="proposed-change-card" style="margin-top: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(168,85,247,0.25); border-radius: 10px; padding: 12px;">
                        <div style="font-size:0.75rem; font-weight:600; color:#d8b4fe; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-file-pen"></i> Alterações Propostas em: <strong>${payload.proposal.document_title}</strong>
                        </div>
                        <div class="diff-container">
                            ${diffLinesHtml || '<div style="color: var(--text-muted); font-style: italic; padding: 4px;">Nenhuma alteração textual detectada.</div>'}
                        </div>
                        <div style="display:flex; justify-content:flex-end;">
                            <button class="approve-proposal-btn" onclick="applyProposedChange(this, '${payload.proposal.document_id}', '${base64Content}')">
                                <i class="fa-solid fa-circle-check"></i> Aprovar e Aplicar Alterações
                            </button>
                        </div>
                    </div>
                `;
            }
            
            reportHtml = `
                <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06);">
                    <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-purple); margin-bottom:5px; display:flex; align-items:center; gap:5px;">
                        <i class="fa-solid fa-circle-check"></i> Relatório do Subagente
                    </div>
                    <div class="agent-report-container">${formattedReport}</div>
                    ${proposalHtml}
                </div>
            `;
        } else {
            reportHtml = `
                <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; gap:8px; color:var(--text-muted); font-size:0.8rem;" id="agent-working-indicator">
                    <i class="fa-solid fa-gear fa-spin" style="color:var(--accent-purple);"></i> Agente trabalhando em segundo plano...
                </div>
            `;
        }
        
        return `
            <div style="background:rgba(139,92,246,0.07); border:1px solid rgba(139,92,246,0.18); border-radius:10px; padding:12px 14px; margin-bottom:4px;">
                <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); margin-bottom:6px; display:flex; align-items:center; gap:5px;">
                    <i class="fa-solid fa-list-check"></i> Tarefa
                </div>
                <div style="font-size:0.84rem; color:var(--text-light); word-break:break-word;">${task.message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                ${reportHtml}
            </div>
        `;
    }).join('');
    el.scrollTop = el.scrollHeight;
}

let agentPollInterval = null;

async function sendAgentMessage() {
    if (!currentAgentId) return;
    const input = document.getElementById('agent-chat-input');
    const sendBtn = document.getElementById('agent-chat-send-btn');
    const task = input.value.trim();
    if (!task) return;

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-hourglass-half fa-spin"></i>';

    // Show task card immediately
    const messagesEl = document.getElementById('agent-chat-messages');
    // Clear empty state if needed
    if (messagesEl.querySelector('.fa-inbox')) messagesEl.innerHTML = '';

    const taskCard = document.createElement('div');
    taskCard.style.cssText = 'background:rgba(139,92,246,0.07);border:1px solid rgba(139,92,246,0.18);border-radius:10px;padding:12px 14px;margin-bottom:4px;';
    taskCard.innerHTML = `
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px;display:flex;align-items:center;gap:5px;">
            <i class="fa-solid fa-list-check"></i> Tarefa
        </div>
        <div style="font-size:0.84rem;color:var(--text-light);word-break:break-word;">${task.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <div id="agent-status-row" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.8rem;">
            <i class="fa-solid fa-gear fa-spin" style="color:var(--accent-purple);"></i> Enviando tarefa ao agente...
        </div>
    `;
    messagesEl.appendChild(taskCard);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/agents/${currentAgentId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: task })
        });
        const data = await res.json();

        const statusRow = taskCard.querySelector('#agent-status-row');
        if (statusRow) {
            statusRow.innerHTML = `<i class="fa-solid fa-gear fa-spin" style="color:var(--accent-purple);"></i> Agente trabalhando em segundo plano...`;
        }

        // Poll for completion
        const aiMsgsBefore = await getAgentAiMsgCount();
        if (agentPollInterval) clearInterval(agentPollInterval);
        agentPollInterval = setInterval(async () => {
            try {
                const pollRes = await fetch(`/api/writer/environments/${currentEnvId}/agents/${currentAgentId}/last`);
                const pollData = await pollRes.json();
                if (pollData.done) {
                    const newCount = await getAgentAiMsgCount();
                    if (newCount > aiMsgsBefore) {
                        clearInterval(agentPollInterval);
                        agentPollInterval = null;
                        
                        // Fetch all messages and re-render completely to show format/proposals properly
                        const resMessages = await fetch(`/api/writer/environments/${currentEnvId}/agents/${currentAgentId}/messages`);
                        const msgsList = await resMessages.json();
                        renderAgentMessages(msgsList);
                        
                        input.disabled = false;
                        sendBtn.disabled = false;
                        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
                        await loadAgents();
                        await loadChatMessages();
                    }
                }
            } catch (e) { /* keep polling */ }
        }, 2500);

    } catch (err) {
        console.error('Error sending agent task:', err);
        input.disabled = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
}

async function getAgentAiMsgCount() {
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/agents/${currentAgentId}/messages`);
        const msgs = await res.json();
        return msgs.filter(m => m.sender === 'ai').length;
    } catch { return 0; }
}

window.openAgentChat = openAgentChat;
window.deleteAgent = deleteAgent;
window.resetAgent = resetAgent;
window.sendAgentMessage = sendAgentMessage;

// Academic Citation Click Handler
document.addEventListener('click', async function (e) {
    const citationEl = e.target.closest('.writer-citation');
    if (citationEl) {
        e.preventDefault();
        const materialId = citationEl.getAttribute('data-material-id');
        const snippet = citationEl.getAttribute('data-snippet');
        const page = citationEl.getAttribute('data-page');
        if (materialId) {
            await openCitationModal(materialId, snippet, page);
        }
    }
});

async function openCitationModal(materialId, snippet, page) {
    const modal = document.getElementById('citation-modal');
    const titleEl = document.getElementById('citation-modal-title');
    const contentEl = document.getElementById('citation-modal-content');

    if (!modal || !contentEl) return;

    contentEl.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px; color: var(--accent-purple);"></i> Carregando fonte original...</div>';
    openWriterModal('citation-modal');
    
    try {
        const url = `/api/writer/environments/${currentEnvId}/materials/${materialId}/text?snippet=${encodeURIComponent(snippet || '')}&page=${encodeURIComponent(page || '')}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            let pageLabel = (page && page !== 'n/a') ? ` (Pág. ${page})` : '';
            titleEl.textContent = `Origem da Citação: ${data.name}${pageLabel}`;

            if (data.has_pdf && data.pdf_url) {
                let pdfUrlWithPage = data.pdf_url;
                if (page && page !== 'n/a') {
                    pdfUrlWithPage += `#page=${page}`;
                }
                contentEl.innerHTML = `<iframe src="${pdfUrlWithPage}" style="width: 100%; height: 60vh; border: none; border-radius: 4px; background: white;"></iframe>`;
                return;
            }

            let fullText = data.content_text || '';

            if (snippet && snippet.trim().length > 3) {
                const cleanSnippet = snippet.trim();

                // Normalization helper (remove punctuation and collapse spaces)
                const normalize = (str) => {
                    return str.toLowerCase()
                        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]?]/g, "")
                        .replace(/\s+/g, " ")
                        .trim();
                };

                const normFull = normalize(fullText);
                const normSnippet = normalize(cleanSnippet);

                let index = -1;
                let matchLength = 0;

                // 1. Try exact normalized match
                let normIndex = normFull.indexOf(normSnippet);
                if (normIndex !== -1) {
                    const escapedWords = normSnippet.split(' ').map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
                    const regexStr = escapedWords.join('[^a-zA-Z0-9À-ÿ]*');
                    try {
                        const regex = new RegExp(regexStr, 'i');
                        const match = fullText.match(regex);
                        if (match) {
                            index = match.index;
                            matchLength = match[0].length;
                        }
                    } catch (e) {
                        console.error('Regex match error:', e);
                    }
                }

                // 2. Fallback: Try with the first 4 words of the snippet
                if (index === -1) {
                    const words = normSnippet.split(' ').filter(w => w.length > 2);
                    if (words.length >= 4) {
                        const subWords = words.slice(0, 4);
                        const subRegexStr = subWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('[^a-zA-Z0-9À-ÿ]*');
                        try {
                            const regex = new RegExp(subRegexStr, 'i');
                            const match = fullText.match(regex);
                            if (match) {
                                index = match.index;
                                matchLength = match[0].length;
                            }
                        } catch (e) {
                            console.error('Sub-regex match error:', e);
                        }
                    }
                }

                if (index !== -1 && matchLength > 0) {
                    // Match found! Highlight and scroll
                    const before = fullText.substring(0, index);
                    const match = fullText.substring(index, index + matchLength);
                    const after = fullText.substring(index + matchLength);

                    const escapeHtml = (str) => {
                        return str
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#039;');
                    };

                    contentEl.innerHTML = escapeHtml(before) +
                        `<mark id="citation-highlight" style="background: #eab308; color: #000000; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #ca8a04; box-shadow: 0 0 10px rgba(234, 179, 8, 0.4);">` +
                        escapeHtml(match) +
                        `</mark>` +
                        escapeHtml(after);

                    // Scroll to highlight container-aware
                    setTimeout(() => {
                        const container = document.getElementById('citation-modal-content');
                        const hl = document.getElementById('citation-highlight');
                        if (container && hl) {
                            const containerTop = container.getBoundingClientRect().top;
                            const hlTop = hl.getBoundingClientRect().top;
                            const relativeTop = hlTop - containerTop;
                            container.scrollTo({
                                top: container.scrollTop + relativeTop - (container.clientHeight / 2),
                                behavior: 'smooth'
                            });
                        }
                    }, 250);
                    return;
                }
            }

            // Fallback if match not found
            contentEl.textContent = fullText;
        } else {
            contentEl.innerHTML = `<div style="color: var(--accent-pink); text-align: center; padding: 20px;"><i class="fa-solid fa-triangle-exclamation" style="margin-bottom: 10px; font-size: 24px;"></i><br>${data.error || 'Erro ao carregar o conteúdo do material.'}</div>`;
        }
    } catch (err) {
        console.error('Error opening citation modal:', err);
        contentEl.innerHTML = `<div style="color: var(--accent-pink); text-align: center; padding: 20px;">Erro de rede ao carregar citação.</div>`;
    }
}

window.openCitationModal = openCitationModal;

window.applyChatToEditor = function (btn) {
    const textEl = btn.closest('.chat-text');
    if (!textEl) return;

    // Clone node to strip the button actions element
    const clone = textEl.cloneNode(true);
    const actions = clone.querySelector('.chat-bubble-actions');
    if (actions) actions.remove();

    // Extract the cleaned HTML content
    const cleanedHtml = clone.innerHTML.trim();

    // Target the editor
    richEditor.focus();

    // Try to insert HTML at cursor position, or append if selection not active
    try {
        if (!document.execCommand('insertHTML', false, cleanedHtml)) {
            richEditor.innerHTML += cleanedHtml;
        }
    } catch (e) {
        richEditor.innerHTML += cleanedHtml;
    }

    // Update document statistics and save status
    updateStats();
    saveCurrentDocument();

    // Provide temporary visual success animation on the button
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Aplicado!';
    btn.style.borderColor = '#22c55e';
    btn.style.color = '#22c55e';
    btn.style.background = 'rgba(34, 197, 94, 0.15)';
    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.style.borderColor = 'rgba(168, 85, 247, 0.35)';
        btn.style.color = '#d8b4fe';
        btn.style.background = 'rgba(168, 85, 247, 0.12)';
    }, 1500);
};

// Setup Drag and Drop File Upload
function setupDragAndDrop() {
    const dragDropOverlay = document.getElementById('drag-drop-overlay');
    const dragDropCancelBtn = document.getElementById('drag-drop-cancel-btn');
    const dropZones = document.querySelectorAll('.drop-zone');

    let dragCounter = 0;

    // Show overlay when dragging files into window
    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (!currentEnvId) return;
        
        if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
            dragCounter++;
            if (dragCounter === 1) {
                dragDropOverlay.style.display = 'flex';
            }
        }
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!currentEnvId) return;
        
        dragCounter--;
        if (dragCounter === 0) {
            dragDropOverlay.style.display = 'none';
        }
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dragDropOverlay.style.display = 'none';
    });

    // Close on cancel click
    if (dragDropCancelBtn) {
        dragDropCancelBtn.addEventListener('click', () => {
            dragCounter = 0;
            dragDropOverlay.style.display = 'none';
        });
    }

    // Close when clicking overlay backdrop
    if (dragDropOverlay) {
        dragDropOverlay.addEventListener('click', (e) => {
            if (e.target === dragDropOverlay) {
                dragCounter = 0;
                dragDropOverlay.style.display = 'none';
            }
        });
    }

    // Drop zone dragover/dragleave visual feedback
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-active');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-active');
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-active');
            dragCounter = 0;
            dragDropOverlay.style.display = 'none';

            if (!currentEnvId) {
                alert('Selecione um Ambiente primeiro.');
                return;
            }

            const files = e.dataTransfer.files;
            if (files.length === 0) return;

            const materialType = zone.getAttribute('data-type');
            await handleMultipleFilesUpload(files, materialType);
        });
        
        // Fallback: click to select files in that category
        zone.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.pdf,.txt';
            input.onchange = async (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    const materialType = zone.getAttribute('data-type');
                    await handleMultipleFilesUpload(files, materialType);
                }
            };
            input.click();
        });
    });
}

// Upload multiple files in parallel and track their individual status
async function handleMultipleFilesUpload(files, materialType) {
    const uploadStatusOverlay = document.getElementById('upload-status-overlay');
    const uploadFileList = document.getElementById('upload-file-list');
    
    if (!uploadStatusOverlay || !uploadFileList) return;

    // Show status overlay
    uploadFileList.innerHTML = '';
    uploadStatusOverlay.style.display = 'flex';

    // Create file status rows in overlay
    const fileTasks = [];
    const filesArray = Array.from(files);

    filesArray.forEach((file, index) => {
        const row = document.createElement('div');
        row.className = 'upload-file-row';
        row.id = `upload-file-${index}`;
        
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const iconClass = isPdf ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-lines';
        
        row.innerHTML = `
            <div class="upload-file-info">
                <i class="${iconClass}"></i>
                <span class="upload-file-name" title="${file.name}">${file.name}</span>
            </div>
            <div class="upload-file-status pending">
                <i class="fa-solid fa-clock"></i> Pendente
            </div>
        `;
        uploadFileList.appendChild(row);

        // Upload task promise
        const uploadPromise = (async () => {
            const statusDiv = row.querySelector('.upload-file-status');
            statusDiv.className = 'upload-file-status uploading';
            statusDiv.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Enviando...`;

            const formData = new FormData();
            
            // Determine endpoint and variables based on materialType
            let url = `/api/writer/environments/${currentEnvId}/materials`;
            if (materialType === 'context') {
                url = `/api/writer/environments/${currentEnvId}/contexts`;
                formData.append('name', file.name);
                formData.append('file', file);
            } else {
                formData.append('material_type', materialType);
                formData.append('name', file.name);
                formData.append('file', file);
            }

            try {
                const res = await fetch(url, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await res.json();
                if (res.ok && data.success) {
                    statusDiv.className = 'upload-file-status success';
                    statusDiv.innerHTML = `<i class="fa-solid fa-circle-check"></i> Concluído`;
                } else {
                    statusDiv.className = 'upload-file-status error';
                    statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${data.error || 'Erro'}`;
                }
            } catch (err) {
                console.error('Error uploading file:', err);
                statusDiv.className = 'upload-file-status error';
                statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Erro de Conexão`;
            }
        })();

        fileTasks.push(uploadPromise);
    });

    // Wait for all uploads to complete
    await Promise.all(fileTasks);

    // Refresh materials and production context panels
    await loadMaterials();
    await loadProductionContext();

    // Hide overlay after 2 seconds
    setTimeout(() => {
        uploadStatusOverlay.style.transition = 'opacity 0.5s ease';
        uploadStatusOverlay.style.opacity = '0';
        setTimeout(() => {
            uploadStatusOverlay.style.display = 'none';
            uploadStatusOverlay.style.opacity = '1';
            uploadStatusOverlay.style.transition = '';
        }, 500);
    }, 2000);
}

// Reusable browser Speech-to-Text initialization function
function initSpeechRecognition(buttonId, inputId) {
    const btn = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        btn.style.display = 'none'; // Hide if not supported in browser
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    recognition.maxAlternatives = 1;

    let isRecording = false;
    let finalTranscript = '';
    let startInputValue = '';
    let selectionStartPos = 0;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isRecording) {
            recognition.stop();
        } else {
            finalTranscript = '';
            startInputValue = input.value;
            selectionStartPos = input.selectionStart || 0;
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isRecording = true;
        btn.classList.add('recording');
        btn.innerHTML = '<i class="fa-solid fa-microphone-lines fa-fade"></i>';
    };

    recognition.onend = async () => {
        isRecording = false;
        btn.classList.remove('recording');
        
        const textToCorrect = finalTranscript.trim();
        if (textToCorrect) {
            // Show magic wand animation to indicate AI correction is active
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles fa-spin" style="color: #c084fc;"></i>';
            try {
                const response = await fetch('/api/writer/correct-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: textToCorrect })
                });
                const data = await response.json();
                if (data.corrected_text) {
                    const before = startInputValue.substring(0, selectionStartPos);
                    const after = startInputValue.substring(selectionStartPos, startInputValue.length);
                    const separator = before && !before.endsWith(' ') ? ' ' : '';
                    input.value = before + separator + data.corrected_text + after;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } catch (err) {
                console.error('Speech correction error:', err);
            }
        }
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isRecording = false;
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        const textToInsert = (finalTranscript + interimTranscript).trim();
        if (textToInsert) {
            const before = startInputValue.substring(0, selectionStartPos);
            const after = startInputValue.substring(selectionStartPos, startInputValue.length);
            const separator = before && !before.endsWith(' ') ? ' ' : '';
            input.value = before + separator + textToInsert + after;
            
            // Trigger input event to resize textarea or enable buttons
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
}
