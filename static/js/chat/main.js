import { state } from './state.js';
import { elements } from './elements.js';
import { checkStatus } from './config.js';
import {
    loadChatHistory,
    clearChat,
    appendMessage,
    showLoading,
    getProxyUrl
} from './history.js';
import { toggleMicRecording } from './recorder.js';
import {
    startVoiceCall,
    endVoiceCall,
    toggleVoiceMute
} from './voice.js';

// Custom marked renderer to inject referrerpolicy and styles into markdown-embedded images
const renderer = new marked.Renderer();
renderer.image = function(href, title, text) {
    const proxyHref = getProxyUrl(href);
    return `<div class="output-img-container" style="max-width: 400px; margin-top: 0.75rem;">
        <img src="${proxyHref}" alt="${text || 'Imagem'}" title="${title || ''}" referrerpolicy="no-referrer" onclick="window.open('${href}', '_blank')" />
        <a href="${proxyHref}" download="gemini-output.png" target="_blank" class="img-download-btn"><i class="fa-solid fa-download"></i></a>
    </div>`;
};

// Initialize marked with highlight.js syntax highlighting
marked.setOptions({
    renderer: renderer,
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-'
});

// Send Message action
async function sendMessage() {
    const text = elements.promptInput.value.trim();
    if (!text) return;

    elements.promptInput.value = '';
    elements.promptInput.style.height = '24px';
    elements.sendBtn.disabled = true;

    appendMessage('user', text);
    const loader = showLoading();

    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        loader.remove();

        const data = await resp.json();
        
        if (resp.ok) {
            appendMessage('ai', data.text, data.images);
        } else {
            appendMessage('ai', `⚠️ **Erro:** ${data.error || 'Não foi possível processar a requisição.'}`);
            if (data.needs_config) {
                state.isConfigured = false;
                state.isActive = false;
                elements.statusDot.className = 'dot';
                elements.statusLabel.textContent = 'Não configurado (Erro/Expirado)';
                elements.configModal.style.display = 'flex';
            }
        }
    } catch (err) {
        loader.remove();
        appendMessage('ai', `⚠️ **Erro de Conexão:** Falha ao comunicar com o servidor proxy.`);
    }
}

// Bind event listeners
function setupEvents() {
    // Auto-resize textarea
    elements.promptInput.addEventListener('input', () => {
        elements.promptInput.style.height = '24px';
        elements.promptInput.style.height = (elements.promptInput.scrollHeight - 6) + 'px';
        elements.sendBtn.disabled = elements.promptInput.value.trim() === '';
    });

    // Send click & enter key actions
    elements.sendBtn.onclick = sendMessage;
    elements.promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Feature Cards quick prompts
    elements.featureCards.forEach(card => {
        card.addEventListener('click', () => {
            const promptText = card.getAttribute('data-prompt');
            elements.promptInput.value = promptText;
            elements.promptInput.style.height = '24px';
            elements.promptInput.style.height = (elements.promptInput.scrollHeight - 6) + 'px';
            elements.sendBtn.disabled = false;
            elements.promptInput.focus();
        });
    });

    // Reset Chat commands
    elements.newChatBtn.onclick = clearChat;
    elements.clearChatTopBtn.onclick = clearChat;

    // Config Modals
    elements.openConfigBtn.onclick = () => {
        elements.configError.style.display = 'none';
        elements.configModal.style.display = 'flex';
    };

    elements.closeConfigBtn.onclick = () => {
        elements.configModal.style.display = 'none';
    };

    elements.sessionCheckBtn.onclick = checkStatus;

    // Save Credentials configuration
    elements.saveConfigBtn.onclick = async () => {
        const apiKey = elements.geminiApiKeyInput.value.trim();
        const sid = elements.secure1psidInput.value.trim();
        const ts = elements.secure1psidtsInput.value.trim();

        if (!apiKey && (!sid || !ts)) {
            elements.configError.textContent = 'Forneça a API Key ou ambos os cookies!';
            elements.configError.style.display = 'block';
            return;
        }

        elements.saveConfigBtn.disabled = true;
        elements.saveConfigBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando configuração...';
        elements.configError.style.display = 'none';

        try {
            const resp = await fetch('/api/save-cookies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    gemini_api_key: apiKey,
                    secure_1psid: sid, 
                    secure_1psidts: ts 
                })
            });
            
            const data = await resp.json();
            if (data.success) {
                elements.configModal.style.display = 'none';
                elements.geminiApiKeyInput.value = '';
                elements.secure1psidInput.value = '';
                elements.secure1psidtsInput.value = '';
                await checkStatus();
            } else {
                elements.configError.textContent = data.error || 'Erro ao inicializar sessão com as credenciais fornecidas.';
                elements.configError.style.display = 'block';
            }
        } catch (err) {
            elements.configError.textContent = 'Erro ao enviar dados para o servidor.';
            elements.configError.style.display = 'block';
        } finally {
            elements.saveConfigBtn.disabled = false;
            elements.saveConfigBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Configuração';
        }
    };

    // Voice mode triggers
    elements.voiceModeBtn.onclick = startVoiceCall;
    elements.endVoiceBtn.onclick = endVoiceCall;
    elements.muteVoiceBtn.onclick = toggleVoiceMute;

    // Speech speed slider
    if (elements.speechSpeed && elements.speedVal) {
        elements.speechSpeed.addEventListener('input', () => {
            elements.speedVal.textContent = `${parseFloat(elements.speechSpeed.value).toFixed(1)}x`;
            if (state.ttsAudioElement && state.isAiSpeaking) {
                state.ttsAudioElement.playbackRate = parseFloat(elements.speechSpeed.value);
            }
        });
    }

    // Microphone toggle
    elements.micBtn.onclick = toggleMicRecording;
}

// Boot setup
document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    checkStatus();
    loadChatHistory();
});
