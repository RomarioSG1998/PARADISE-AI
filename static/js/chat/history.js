import { state } from './state.js';
import { elements } from './elements.js';

export function getProxyUrl(url) {
    if (url && (url.includes("googleusercontent.com") || url.includes("google.com"))) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
}

export function saveChatHistory() {
    localStorage.setItem('paradise_chat_history', JSON.stringify(state.chatHistory));
}

export function appendMessageToDom(sender, text, images = [], audio = null) {
    const welcome = document.getElementById('welcome-screen');
    if (welcome) welcome.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.innerHTML = sender === 'user' ? '<i class="fa-regular fa-user"></i>' : '<i class="fa-solid fa-wand-magic-sparkles"></i>';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bubble';
    
    if (sender === 'ai') {
        bubbleDiv.innerHTML = marked.parse(text);
        
        if (images.length > 0) {
            const gallery = document.createElement('div');
            gallery.className = 'output-gallery';
            let addedAny = false;
            
            images.forEach(imgUrl => {
                if (!bubbleDiv.innerHTML.includes(imgUrl)) {
                    addedAny = true;
                    const container = document.createElement('div');
                    container.className = 'output-img-container';
                    
                    const proxyUrl = getProxyUrl(imgUrl);
                    const img = document.createElement('img');
                    img.src = proxyUrl;
                    img.setAttribute('referrerpolicy', 'no-referrer');
                    img.alt = 'Imagem gerada';
                    img.onclick = () => window.open(imgUrl, '_blank');
                    
                    const dl = document.createElement('a');
                    dl.href = proxyUrl;
                    dl.download = 'gemini-output.png';
                    dl.target = '_blank';
                    dl.className = 'img-download-btn';
                    dl.innerHTML = '<i class="fa-solid fa-download"></i>';
                    
                    container.appendChild(img);
                    container.appendChild(dl);
                    gallery.appendChild(container);
                }
            });
            
            if (addedAny) {
                bubbleDiv.appendChild(gallery);
            }
        }
    } else {
        if (audio) {
            bubbleDiv.innerHTML = `
                <div class="audio-message">
                    <div class="audio-player-wrapper">
                        <audio src="${audio}" controls></audio>
                    </div>
                    <div style="font-size: 0.95rem; color: #d1fae5; line-height: 1.4; border-top: 1px solid rgba(0, 255, 65, 0.15); padding-top: 0.5rem; margin-top: 0.25rem;">
                        <i class="fa-solid fa-quote-left" style="color:var(--text-secondary); font-size:0.8rem; margin-right: 0.25rem;"></i>
                        ${text}
                    </div>
                </div>
            `;
        } else {
            bubbleDiv.textContent = text;
        }
    }

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(bubbleDiv);
    elements.chatWindow.appendChild(messageDiv);
    elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
}

export function appendMessage(sender, text, images = [], audio = null) {
    appendMessageToDom(sender, text, images, audio);
    state.chatHistory.push({ sender, text, images, audio });
    saveChatHistory();
}

export function loadChatHistory() {
    const history = localStorage.getItem('paradise_chat_history');
    if (history) {
        try {
            state.chatHistory = JSON.parse(history) || [];
            if (state.chatHistory.length > 0) {
                const welcome = document.getElementById('welcome-screen');
                if (welcome) welcome.remove();
                state.chatHistory.forEach(msg => {
                    appendMessageToDom(msg.sender, msg.text, msg.images, msg.audio);
                });
            }
        } catch (e) {
            console.error("Failed to load chat history", e);
            state.chatHistory = [];
        }
    }
}

export function clearChat() {
    state.chatHistory = [];
    localStorage.removeItem('paradise_chat_history');

    const welcome = elements.welcomeScreen.cloneNode(true);
    elements.chatWindow.innerHTML = '';
    elements.chatWindow.appendChild(welcome);
    
    const cards = elements.chatWindow.querySelectorAll('.feature-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const promptText = card.getAttribute('data-prompt');
            elements.promptInput.value = promptText;
            elements.promptInput.style.height = '24px';
            elements.promptInput.style.height = (elements.promptInput.scrollHeight - 6) + 'px';
            elements.sendBtn.disabled = false;
            elements.promptInput.focus();
        });
    });
}

export function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai loading-indicator';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bubble';
    bubbleDiv.innerHTML = `
        <div class="loading-dots">
            <div></div>
            <div></div>
            <div></div>
        </div>
    `;
    
    loadingDiv.appendChild(avatarDiv);
    loadingDiv.appendChild(bubbleDiv);
    elements.chatWindow.appendChild(loadingDiv);
    elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
    return loadingDiv;
}
