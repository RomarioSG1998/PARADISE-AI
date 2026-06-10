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
    
    // Visual toggle
    document.querySelectorAll('.env-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.env-item[data-id="${id}"]`);
    if (activeEl) activeEl.classList.add('active');
    
    updateUILayout();
    
    // Load environment documents, materials, and messages
    await loadDocuments();
    await loadMaterials();
    await loadChatMessages();
    
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
                <span><i class="fa-solid fa-file-pdf material-icon"></i> ${m.name}</span>
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
                <span><i class="fa-solid fa-file-pdf material-icon"></i> ${m.name}</span>
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
    
    submitUploadBtn.disabled = true;
    submitUploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    
    const formData = new FormData(uploadMaterialForm);
    
    try {
        const res = await fetch(`/api/writer/environments/${currentEnvId}/materials`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
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
window.switchMaterialTab = function(btn, tabId) {
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
        
        bubble.innerHTML = `
            <div class="chat-avatar">${avatar}</div>
            <div class="chat-text">${formattedMsg}</div>
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
            aiBubble.innerHTML = `
                <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="chat-text">${formatMarkdownSimple(data.message)}</div>
            `;
            chatMessagesContainer.appendChild(aiBubble);
            
            // Apply document update if available
            if (data.document_update !== null && data.document_update !== undefined) {
                richEditor.innerHTML = data.document_update;
                updateStats();
                setSaveStatus("saved");
                
                // Visual feedback of change: quick yellow highlight flash
                richEditor.style.transition = 'none';
                richEditor.style.backgroundColor = 'rgba(253, 224, 71, 0.2)';
                setTimeout(() => {
                    richEditor.style.transition = 'background-color 0.8s ease';
                    richEditor.style.backgroundColor = 'transparent';
                }, 100);
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
window.openWriterModal = function(id) {
    document.getElementById(id).classList.add('active');
};

window.closeWriterModal = function(id) {
    document.getElementById(id).classList.remove('active');
};

// Expand input textareas as user types
chatInput.addEventListener('input', function() {
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
            aiBubble.innerHTML = `
                <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="chat-text">${formatMarkdownSimple(data.message)}</div>
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
