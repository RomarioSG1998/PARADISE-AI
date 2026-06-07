import { state } from './state.js';
import { elements } from './elements.js';
import { bookTranslations } from './translations.js';
import { explainWordDetail } from './dict.js';

export function getProxyUrl(url) {
    if (url && (url.includes("googleusercontent.com") || url.includes("google.com"))) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
}

export function updateLoaderStep(stepId, status) {
    const item = document.getElementById(`step-${stepId}`);
    const icon = document.getElementById(`icon-${stepId}`);
    if (!item || !icon) return;

    if (status === 'active') {
        item.className = 'step-item active';
        icon.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    } else if (status === 'done') {
        item.className = 'step-item done';
        icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    } else {
        item.className = 'step-item';
        icon.innerHTML = '<i class="fa-solid fa-circle"></i>';
    }
}

export function prepareTextForHighlighting(text) {
    let html = "";
    let currentOffset = 0;
    
    const tokens = text.split(/(\s+)/);
    tokens.forEach(token => {
        if (token.trim() === '') {
            html += token;
            currentOffset += token.length;
        } else {
            html += `<span class="word-span" data-start="${currentOffset}" data-end="${currentOffset + token.length}">${token}</span>`;
            currentOffset += token.length;
        }
    });
    return html;
}

export function setPlayState(isPlaying) {
    if (isPlaying) {
        elements.audioPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
        elements.audioPlay.title = "Pausar Narração";
    } else {
        elements.audioPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        elements.audioPlay.title = "Ouvir Capítulo";
    }
}

export function clearHighlights() {
    document.querySelectorAll('#read-chapter-text p').forEach(p => {
        p.classList.remove('speaking-highlight');
        p.querySelectorAll('.word-span').forEach(span => {
            span.classList.remove('word-highlight');
        });
    });
}

let bookAudioEl = null;

export function stopNarration() {
    window.speechSynthesis.cancel();
    if (bookAudioEl) {
        bookAudioEl.pause();
        bookAudioEl.src = '';
    }
    setPlayState(false);
    clearHighlights();
    state.activeParagraphElement = null;
    state.speakingParagraphsQueue = [];
    state.currentSpeakingQueueIndex = 0;
}

export function isPlaying() {
    const audioPlaying = (bookAudioEl && !bookAudioEl.paused && bookAudioEl.src);
    const synthSpeaking = window.speechSynthesis.speaking;
    const queueActive = (state.speakingParagraphsQueue && state.speakingParagraphsQueue.length > 0 && state.currentSpeakingQueueIndex < state.speakingParagraphsQueue.length);
    return audioPlaying || synthSpeaking || queueActive;
}

export function updateAutoPlayUI() {
    const lang = localStorage.getItem('paradise_language') || 'pt';
    const t = bookTranslations[lang] || bookTranslations.pt;
    if (state.autoPlayEnabled) {
        elements.btnAutoPlay.title = t.autoPlayActive || "Página Automática: Ativada";
        elements.autoPlayIcon.className = "fa-solid fa-toggle-on";
        elements.btnAutoPlay.style.color = "#f472b6";
        elements.btnAutoPlay.style.borderColor = "rgba(244, 114, 182, 0.6)";
    } else {
        elements.btnAutoPlay.title = t.autoPlayInactive || "Página Automática: Desativada";
        elements.autoPlayIcon.className = "fa-solid fa-toggle-off";
        elements.btnAutoPlay.style.color = "var(--border-cartoon)";
        elements.btnAutoPlay.style.borderColor = "var(--border-cartoon)";
    }
}

export function triggerPageFlipAnimation(callback) {
    elements.physicalBook.classList.remove('page-flip-animate');
    void elements.physicalBook.offsetWidth;
    elements.physicalBook.classList.add('page-flip-animate');
    
    setTimeout(() => {
        callback();
    }, 250);
    
    setTimeout(() => {
        elements.physicalBook.classList.remove('page-flip-animate');
    }, 500);
}

export function toggleNarration() {
    if (bookAudioEl && !bookAudioEl.paused && bookAudioEl.src) {
        bookAudioEl.pause();
        setPlayState(false);
    } else if (bookAudioEl && bookAudioEl.paused && bookAudioEl.src) {
        bookAudioEl.play();
        setPlayState(true);
    } else if (window.speechSynthesis.speaking) {
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
            setPlayState(true);
        } else {
            window.speechSynthesis.pause();
            setPlayState(false);
        }
    } else {
        const pElements = Array.from(document.querySelectorAll('#read-chapter-text p'));
        if (pElements.length > 0) {
            state.speakingParagraphsQueue = pElements;
            state.currentSpeakingQueueIndex = 0;
            speakQueue();
        }
    }
}

export function speakParagraph(pElement, onFinishedCallback = null) {
    if (bookAudioEl) {
        bookAudioEl.pause();
        bookAudioEl.src = '';
    }
    window.speechSynthesis.cancel();
    clearHighlights();
    
    state.activeParagraphElement = pElement;
    pElement.classList.add('speaking-highlight');

    const rawText = pElement.getAttribute('data-raw-text');

    let speechLang = 'pt-BR';
    const langLower = (state.currentBook.language || '').toLowerCase();
    if (langLower.includes('inglês') || langLower.includes('english') || langLower.includes('en')) speechLang = 'en-US';
    else if (langLower.includes('espanhol') || langLower.includes('spanish') || langLower.includes('es') || langLower.includes('español')) speechLang = 'es-ES';
    else if (langLower.includes('francês') || langLower.includes('french') || langLower.includes('fr')) speechLang = 'fr-FR';
    else if (langLower.includes('italiano') || langLower.includes('italian') || langLower.includes('it')) speechLang = 'it-IT';
    else if (langLower.includes('alemão') || langLower.includes('german') || langLower.includes('de')) speechLang = 'de-DE';

    if (!bookAudioEl) {
        bookAudioEl = new Audio();
    }

    const ttsUrl = `/api/tts?text=${encodeURIComponent(rawText)}&lang=${encodeURIComponent(speechLang)}`;
    
    fetch(ttsUrl).then(response => {
        if (!response.ok) throw new Error("TTS fetch failed");
        return response.blob();
    }).then(blob => {
        const url = URL.createObjectURL(blob);
        bookAudioEl.src = url;
        bookAudioEl.playbackRate = parseFloat(elements.speechRate.value) || 1.0;
        
        const spans = Array.from(pElement.querySelectorAll('.word-span'));
        
        bookAudioEl.onplay = () => {
            if (state.highlightInterval) clearInterval(state.highlightInterval);
            state.highlightInterval = setInterval(() => {
                if (!bookAudioEl || bookAudioEl.paused) return;
                
                let duration = bookAudioEl.duration;
                if (!duration || isNaN(duration) || !isFinite(duration)) return;
                
                const progress = bookAudioEl.currentTime / duration;
                const targetCharIndex = progress * rawText.length;
                
                spans.forEach((span) => {
                    const start = parseInt(span.getAttribute('data-start'));
                    const end = parseInt(span.getAttribute('data-end'));
                    
                    // Highlight the word if the target character index falls within its start/end
                    // or if it's the closest word. To prevent multiple highlights, we just check the range.
                    // We add a small buffer (+1 or -1) if needed, but exact match is usually fine.
                    if (targetCharIndex >= start && targetCharIndex <= end) {
                        span.classList.add('word-highlight');
                        // Only scroll if it's not fully in view (optional, but keep for now)
                        span.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else {
                        span.classList.remove('word-highlight');
                    }
                });
            }, 30);
        };
        
        bookAudioEl.onended = () => {
            if (state.highlightInterval) clearInterval(state.highlightInterval);
            pElement.classList.remove('speaking-highlight');
            spans.forEach(span => span.classList.remove('word-highlight'));
            
            if (onFinishedCallback) onFinishedCallback();
            else stopNarration();
            
            URL.revokeObjectURL(url);
        };

        bookAudioEl.play().catch(e => {
            if (state.highlightInterval) clearInterval(state.highlightInterval);
            fallbackSpeak(rawText, speechLang, pElement, onFinishedCallback);
        });
        
        setPlayState(true);
    }).catch(err => {
        fallbackSpeak(rawText, speechLang, pElement, onFinishedCallback);
    });
}

function fallbackSpeak(rawText, speechLang, pElement, onFinishedCallback) {
    const utterance = new SpeechSynthesisUtterance(rawText);
    utterance.lang = speechLang;
    utterance.rate = parseFloat(elements.speechRate.value) || 1.0;

    utterance.onend = () => {
        pElement.classList.remove('speaking-highlight');
        pElement.querySelectorAll('.word-span').forEach(span => span.classList.remove('word-highlight'));
        if (onFinishedCallback) onFinishedCallback();
        else stopNarration();
    };

    state.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    setPlayState(true);
}

export function speakQueue() {
    if (state.currentSpeakingQueueIndex >= state.speakingParagraphsQueue.length) {
        stopNarration();
        
        if (state.autoPlayEnabled && state.currentBook && state.currentChapterIndex < state.currentBook.chapters.length - 1) {
            setTimeout(() => {
                if (state.autoPlayEnabled && elements.panelReader.style.display === 'flex') {
                    triggerPageFlipAnimation(() => {
                        state.currentChapterIndex++;
                        renderChapter();
                        setTimeout(() => {
                            if (elements.panelReader.style.display === 'flex') {
                                const pElements = Array.from(document.querySelectorAll('#read-chapter-text p'));
                                if (pElements.length > 0) {
                                    state.speakingParagraphsQueue = pElements;
                                    state.currentSpeakingQueueIndex = 0;
                                    speakQueue();
                                }
                            }
                        }, 400);
                    });
                }
            }, 500);
        } else if (state.autoPlayEnabled && state.currentBook && state.currentChapterIndex === state.currentBook.chapters.length - 1) {
            window.dispatchEvent(new Event('book-finished'));
            setTimeout(() => {
                alert("Fim da aventura ilustrada! Deseja criar mais histórias?");
            }, 500);
        }
        return;
    }

    const pElement = state.speakingParagraphsQueue[state.currentSpeakingQueueIndex];
    speakParagraph(pElement, () => {
        state.currentSpeakingQueueIndex++;
        speakQueue();
    });
}

export function renderChapter() {
    if (!state.currentBook || !state.currentBook.chapters) return;

    stopNarration();

    const chapter = state.currentBook.chapters[state.currentChapterIndex];
    
    elements.readMetaInfo.textContent = `${state.currentBook.theme} · Nível: ${state.currentBook.level} · Idioma: ${state.currentBook.language}`;
    elements.readPageCounter.textContent = `Página ${chapter.chapter_number} de ${state.currentBook.chapters.length}`;
    elements.readChapterTitle.textContent = chapter.title;

    elements.bookScrollBody.scrollTop = 0;

    if (chapter.image_url) {
        const proxyBg = getProxyUrl(chapter.image_url);
        elements.bookScrollBody.style.backgroundImage = `url("${proxyBg}")`;
    } else {
        elements.bookScrollBody.style.backgroundImage = 'none';
    }

    elements.readChapterText.innerHTML = '';
    
    const paragraphs = chapter.text.split('\n').filter(p => p.trim() !== '');
    paragraphs.forEach((pText, pIdx) => {
        const cleanText = pText.replace(/[*_~`#]/g, '').replace(/<\/?[^>]+(>|$)/g, "").trim();
        if (!cleanText) return;

        const p = document.createElement('p');
        p.setAttribute('data-idx', pIdx);
        p.setAttribute('data-raw-text', cleanText);
        p.innerHTML = prepareTextForHighlighting(cleanText);

        p.querySelectorAll('.word-span').forEach(wordSpan => {
            wordSpan.onclick = (e) => {
                e.stopPropagation();
                const word = wordSpan.textContent.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g,"");
                if (word.length > 0) {
                    explainWordDetail(word, pText, e.clientX, e.clientY);
                }
            };
        });

        const tools = document.createElement('span');
        tools.className = 'paragraph-tools';
        
        const playBtn = document.createElement('button');
        playBtn.className = 'tool-btn';
        playBtn.title = "Ouvir este parágrafo";
        playBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        playBtn.onclick = (e) => {
            e.stopPropagation();
            speakParagraph(p);
        };

        tools.appendChild(playBtn);
        p.appendChild(tools);
        elements.readChapterText.appendChild(p);
    });

    elements.readIllustrationImg.className = 'loading';
    if (chapter.image_url) {
        const imgUrl = getProxyUrl(chapter.image_url);
        elements.readIllustrationImg.onload = () => elements.readIllustrationImg.className = '';
        elements.readIllustrationImg.src = imgUrl;
        elements.readIllustrationImg.style.display = 'block';
        elements.readIllustrationImg.style.cursor = 'pointer';
        elements.readIllustrationImg.onclick = () => window.open(chapter.image_url || imgUrl, '_blank');
        
        elements.downloadIllustrationBtn.href = imgUrl;
        elements.downloadIllustrationBtn.style.display = 'flex';
        
        document.getElementById('illustration-error').style.display = 'none';
    } else {
        elements.readIllustrationImg.src = '';
        elements.readIllustrationImg.alt = 'Sem desenho';
        elements.readIllustrationImg.className = '';
        elements.readIllustrationImg.style.display = 'none';
        elements.downloadIllustrationBtn.style.display = 'none';
        document.getElementById('illustration-error').style.display = 'flex';
        if (chapter.image_error) {
            document.getElementById('illustration-error-msg').textContent = chapter.image_error;
        } else {
            document.getElementById('illustration-error-msg').textContent = 'Nenhuma imagem foi gerada pelo Gemini para este capítulo.';
        }
    }

    elements.btnPrevPage.disabled = state.currentChapterIndex === 0;
    if (state.currentChapterIndex === state.currentBook.chapters.length - 1) {
        elements.btnNextPage.innerHTML = 'Fim <i class="fa-solid fa-flag-checkered"></i>';
    } else {
        elements.btnNextPage.innerHTML = 'Próximo <i class="fa-solid fa-arrow-right"></i>';
    }
}
