import { state } from './state.js';
import { elements } from './elements.js';
import { getProxyUrl } from './player.js';

export function closeTranslationBubble() {
    if (elements.translationBubble) {
        elements.translationBubble.style.display = 'none';
    }
}

export async function explainWordDetail(word, sentence, x, y) {
    closeTranslationBubble();
    if (!elements.translationBubble) return;
    
    let bubbleLeft = x + window.scrollX - 40;
    if (bubbleLeft + 330 > window.innerWidth) {
        bubbleLeft = window.innerWidth - 350;
    }
    if (bubbleLeft < 10) bubbleLeft = 10;

    let bubbleTop = y + window.scrollY - 195;
    if (bubbleTop < 10) bubbleTop = 10;

    elements.translationBubble.style.left = `${bubbleLeft}px`;
    elements.translationBubble.style.top = `${bubbleTop}px`;
    elements.translationBubble.style.display = 'flex';
    
    elements.translationBubble.innerHTML = `
        <div class="translation-bubble-header">
            <span>Dicionário do Livro</span>
            <button class="translation-bubble-close" id="btn-close-bubble-x">&times;</button>
        </div>
        <div class="word-explorer-content">
            <div class="word-info">
                <div style="font-size: 1.15rem; font-weight: 800; color: #1e293b; text-transform: capitalize;">${word}</div>
                <div id="word-translation" style="margin-top: 0.3rem; font-weight: 700; color: var(--accent-pink); font-size: 0.95rem;">Traduzindo...</div>
                <div id="word-explanation" style="margin-top: 0.4rem; font-size: 0.82rem; color: #475569; line-height: 1.3;">Buscando significado...</div>
            </div>
            <div id="word-illustration-box" class="word-micro-img">
                <i class="fa-solid fa-spinner fa-spin" style="color: #64748b; font-size: 1.3rem;"></i>
            </div>
        </div>
    `;

    document.getElementById('btn-close-bubble-x').onclick = (e) => {
        e.stopPropagation();
        closeTranslationBubble();
    };
    
    try {
        const resp = await fetch('/api/book/explain-word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                word: word,
                sentence: sentence,
                book_language: state.currentBook.language,
                language: localStorage.getItem('paradise_language') || 'pt'
            })
        });
        
        if (!resp.ok) throw new Error();
        const data = await resp.json();
        
        const transEl = document.getElementById('word-translation');
        const expEl = document.getElementById('word-explanation');
        const imgBox = document.getElementById('word-illustration-box');
        
        if (transEl) transEl.textContent = data.translation;
        if (expEl) expEl.textContent = data.explanation;
        
        if (imgBox) {
            if (data.image_url) {
                const proxyUrl = getProxyUrl(data.image_url);
                imgBox.innerHTML = `
                    <div class="output-img-container" style="position: relative; width: 100%; height: 100%;">
                        <img src="${proxyUrl}" alt="${word}" referrerpolicy="no-referrer" onclick="window.open('${data.image_url || proxyUrl}', '_blank')" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;">
                        <a href="${proxyUrl}" download="${word}-concept.png" target="_blank" class="img-download-btn" style="position: absolute; bottom: 4px; right: 4px; background: rgba(0, 0, 0, 0.75); border: 1.5px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 6px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 0.8rem; z-index: 10;" title="Baixar conceito"><i class="fa-solid fa-download"></i></a>
                    </div>`;
            } else {
                imgBox.innerHTML = `<i class="fa-solid fa-image-slash" style="color: #94a3b8; font-size: 1.1rem;"></i>`;
            }
        }
    } catch (e) {
        const transEl = document.getElementById('word-translation');
        const expEl = document.getElementById('word-explanation');
        const imgBox = document.getElementById('word-illustration-box');
        if (transEl) transEl.textContent = "Erro de conexão";
        if (expEl) expEl.textContent = "Não foi possível carregar a tradução contextual.";
        if (imgBox) imgBox.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: #ef4444; font-size: 1.2rem;"></i>`;
    }
}
