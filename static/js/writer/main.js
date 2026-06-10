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
    uploadMaterialBtn.addEventListener('click', () => openWriterModal('upload-material-modal'));
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
    docTitleInput.value = title === 'Sem título' ? '' : title;
    richEditor.innerHTML = content || '';

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
        const formattedMsg = formatMarkdownSimple(m.message);

        let actionsHtml = '';
        if (m.sender === 'ai') {
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
                richEditor.innerHTML = data.document_update;
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
            const listItems = p.split(/\n[-*]\s/).map(li => `<li>${li.replace(/^[-*]\s/, '')}</li>`).join('');
            return `<ul>${listItems}</ul>`;
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

async function loadAgents() {
    if (!currentEnvId) return;
    const container = document.getElementById('agents-list-container');
    if (!container) return;
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/agents`);
        const agents = await res.json();
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
        item.innerHTML = `
            <div class="agent-item-info" onclick="openAgentChat('${agent.id}', '${agent.name.replace(/'/g,"\\'")}', '${(agent.role||'').replace(/'/g,"\\'")}')">
                <div class="agent-item-name">
                    <i class="fa-solid fa-robot" style="font-size:0.8rem; color:${agent.is_leader ? 'var(--accent-pink)' : 'var(--accent-purple)'}"></i>
                    ${agent.name}
                    ${agent.is_leader ? '<span class="agent-badge">Líder</span>' : ''}
                </div>
                <div class="agent-item-role">${agent.role || 'sub-agente'}</div>
            </div>
            <div class="agent-actions">
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

    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/agents/${agentId}/messages`);
        const msgs = await res.json();
        renderAgentMessages(msgs);
    } catch (err) {
        console.error('Error loading agent messages:', err);
        messagesEl.innerHTML = '<div style="color:var(--accent-pink);text-align:center;padding:20px;">Erro ao carregar histórico.</div>';
    }

    const input = document.getElementById('agent-chat-input');
    if (input) {
        input.placeholder = `Atribua uma tarefa a ${agentName}...`;
        input.focus();
    }
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

    el.innerHTML = pairs.map(({ task, report }) => `
        <div style="background:rgba(139,92,246,0.07); border:1px solid rgba(139,92,246,0.18); border-radius:10px; padding:12px 14px; margin-bottom:4px;">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); margin-bottom:6px; display:flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-list-check"></i> Tarefa
            </div>
            <div style="font-size:0.84rem; color:var(--text-light); word-break:break-word;">${task.message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
            ${report
                ? `<div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06);">
                    <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-purple); margin-bottom:5px; display:flex; align-items:center; gap:5px;">
                        <i class="fa-solid fa-circle-check"></i> Relatório
                    </div>
                    <div style="font-size:0.84rem; color:var(--text-light); line-height:1.5; word-break:break-word;">${report.message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                   </div>`
                : `<div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; gap:8px; color:var(--text-muted); font-size:0.8rem;" id="agent-working-indicator">
                    <i class="fa-solid fa-gear fa-spin" style="color:var(--accent-purple);"></i> Agente trabalhando em segundo plano...
                   </div>`
            }
        </div>
    `).join('');
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
                        // Replace working indicator with report
                        if (statusRow) {
                            statusRow.innerHTML = `
                                <div style="width:100%">
                                    <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent-purple);margin-bottom:5px;display:flex;align-items:center;gap:5px;">
                                        <i class="fa-solid fa-circle-check"></i> Relatório
                                    </div>
                                    <div style="font-size:0.84rem;color:var(--text-light);line-height:1.5;word-break:break-word;">${pollData.message.message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                                </div>
                            `;
                        }
                        input.disabled = false;
                        sendBtn.disabled = false;
                        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
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
