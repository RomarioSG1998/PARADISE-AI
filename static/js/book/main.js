import { state } from './state.js';
import { elements } from './elements.js';
import { bookTranslations } from './translations.js';
import { checkStatus } from './config.js';
import { renderHistoryList, saveBookToHistory } from './history.js';
import { closeTranslationBubble } from './dict.js';
import {
    renderChapter,
    triggerPageFlipAnimation,
    updateAutoPlayUI,
    stopNarration,
    toggleNarration,
    speakQueue,
    getProxyUrl,
    updateLoaderStep
} from './player.js';
import { attachVoiceInput } from '../voice_input.js';
// Apply Language Settings
export function applyLanguage(lang) {
    localStorage.setItem("paradise_language", lang);
    document.cookie = `paradise_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    
    const t = bookTranslations[lang] || bookTranslations.pt;
    
    const brandTitle = document.getElementById('book-brand-title');
    if (brandTitle) brandTitle.textContent = t.brandTitle;
    
    const panelTitle = document.querySelector('.config-form .form-title h2');
    if (panelTitle) panelTitle.textContent = t.panelTitle;
    
    const panelDesc = document.querySelector('.config-form .form-title p');
    if (panelDesc) panelDesc.textContent = t.panelDesc;
    
    const lblTheme = document.querySelector('label[for="book-theme"]');
    if (lblTheme) lblTheme.textContent = t.lblTheme;
    
    const inputTheme = document.getElementById('book-theme');
    if (inputTheme) inputTheme.placeholder = t.placeholderTheme;
    
    const lblLevel = document.querySelector('label[for="book-level"]');
    if (lblLevel) lblLevel.textContent = t.lblLevel;
    
    const lblLang = document.querySelector('label[for="book-lang"]');
    if (lblLang) lblLang.textContent = t.lblLang;
    
    if (elements.lblVisualTheme) elements.lblVisualTheme.textContent = t.lblVisualTheme;
    if (elements.visualThemeSelect) {
        elements.visualThemeSelect.options[0].text = t.themeOptionClassic;
        elements.visualThemeSelect.options[1].text = t.themeOptionRealistic;
        elements.visualThemeSelect.options[2].text = t.themeOptionMedieval;
        elements.visualThemeSelect.options[3].text = t.themeOptionCaveman;
        elements.visualThemeSelect.options[4].text = t.themeOptionAnime;
        elements.visualThemeSelect.options[5].text = t.themeOptionDisney;
    }
    
    if (elements.btnGenerate) elements.btnGenerate.innerHTML = t.btnGenerate;
    
    const lblSaved = document.querySelector('.history-panel .form-title h3');
    if (lblSaved) lblSaved.innerHTML = `<i class="fa-solid fa-book-open"></i> ${t.lblSavedBooks}`;
    
    const descSaved = document.querySelector('.history-panel .form-title p');
    if (descSaved) descSaved.textContent = t.descSavedBooks;
    
    // Connection Status Label
    if (elements.statusLabel) {
        if (elements.statusLabel.textContent === 'Verificando...' || elements.statusLabel.textContent === 'Checking...') {
            elements.statusLabel.textContent = t.connectionChecking;
        } else if (elements.statusLabel.textContent.includes('Ativa') || elements.statusLabel.textContent.includes('Active')) {
            elements.statusLabel.textContent = t.connectionOnline;
        } else {
            elements.statusLabel.textContent = t.connectionOffline;
        }
    }
    
    const bookLangSelect = document.getElementById('book-lang');
    if (bookLangSelect) {
        if (lang === 'pt') {
            bookLangSelect.value = 'Português';
        } else if (lang === 'en') {
            bookLangSelect.value = 'Inglês';
        } else if (lang === 'es') {
            bookLangSelect.value = 'Espanhol';
        }
        
        const ptOpt = bookLangSelect.querySelector('option[value="Português"]');
        if (ptOpt) ptOpt.textContent = t.langOptionPt;
        const enOpt = bookLangSelect.querySelector('option[value="Inglês"]');
        if (enOpt) enOpt.textContent = t.langOptionEn;
        const esOpt = bookLangSelect.querySelector('option[value="Espanhol"]');
        if (esOpt) esOpt.textContent = t.langOptionEs;
    }
    
    const langSelect = document.getElementById('global-lang-select');
    if (langSelect) langSelect.value = lang;

    updateAutoPlayUI();
}

// Background opacity styling updates
function updateBgOpacity(val) {
    const opacity = val / 100;
    document.documentElement.style.setProperty('--text-box-bg-opacity', opacity);
    if (elements.bgOpacityValue) {
        elements.bgOpacityValue.textContent = `${val}%`;
    }
}

// Apply visual theme font and style to reader panel
const VISUAL_THEME_FONTS = {
    classic:  "'Cinzel', serif",
    realistic: "'Outfit', sans-serif",
    medieval: "'Outfit', sans-serif",
    caveman:  "'Caveat', cursive",
    anime:    "'Outfit', sans-serif",
    disney:   "'Outfit', sans-serif"
};

const VISUAL_THEME_COLORS = {
    classic:   { accent: '#102a1e', title: '#8b5a2b' },
    realistic: { accent: '#3b82f6', title: '#f8fafc' },
    medieval:  { accent: '#8b5a2b', title: '#3b2314' },
    caveman:   { accent: '#ebdcb9', title: '#ebdcb9' },
    anime:     { accent: '#ec4899', title: '#fdf4ff' },
    disney:    { accent: '#6366f1', title: '#e0e7ff' }
};

export function applyVisualTheme(theme) {
    const font = VISUAL_THEME_FONTS[theme] || VISUAL_THEME_FONTS.classic;
    const colors = VISUAL_THEME_COLORS[theme] || VISUAL_THEME_COLORS.classic;
    const panelReader = document.getElementById('panel-reader');
    if (panelReader) {
        panelReader.style.fontFamily = font;
    }
    
    const bookContainer = document.getElementById('physical-book');
    if (bookContainer) {
        // Remove existing style-* classes
        const classesToRemove = [];
        bookContainer.classList.forEach(cls => {
            if (cls.startsWith('style-')) {
                classesToRemove.push(cls);
            }
        });
        classesToRemove.forEach(cls => bookContainer.classList.remove(cls));
        bookContainer.classList.add(`style-${theme}`);
    }

    document.documentElement.style.setProperty('--reader-accent', colors.accent);
    document.documentElement.style.setProperty('--reader-title-color', colors.title);
    // Apply chapter title inline so it's immediate
    const chapterTitle = document.getElementById('read-chapter-title');
    if (chapterTitle) chapterTitle.style.fontFamily = font;
}

// Bind Event Listeners
function setupEvents() {
    // Generate Action
    elements.btnGenerate.onclick = async () => {
        const theme = document.getElementById('book-theme').value.trim();
        const level = document.getElementById('book-level').value;
        const lang = document.getElementById('book-lang').value;
        const visual_theme = elements.visualThemeSelect ? elements.visualThemeSelect.value : 'cartoon';
        const duration = document.getElementById('book-duration') ? document.getElementById('book-duration').value : '3';

        if (!theme) {
            alert("Por favor, digite uma ideia ou enredo de aventura!");
            return;
        }

        elements.panelForm.style.display = 'none';
        elements.panelLoader.style.display = 'flex';

        updateLoaderStep('write', 'active');
        updateLoaderStep('img1', 'pending');
        updateLoaderStep('img2', 'pending');
        updateLoaderStep('img3', 'pending');

        let timer1 = setTimeout(() => {
            updateLoaderStep('write', 'done');
            updateLoaderStep('img1', 'active');
        }, 9000);

        let timer2 = setTimeout(() => {
            updateLoaderStep('img1', 'done');
            updateLoaderStep('img2', 'active');
        }, 15000);

        let timer3 = setTimeout(() => {
            updateLoaderStep('img2', 'done');
            updateLoaderStep('img3', 'active');
        }, 21000);

        try {
            const resp = await fetch('/api/book/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme, level, language: lang, visual_theme, duration })
            });

            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);

            if (!resp.ok) throw new Error("Erro na geração do livro.");
            const data = await resp.json();
            
            updateLoaderStep('write', 'done');
            updateLoaderStep('img1', 'done');
            updateLoaderStep('img2', 'done');
            updateLoaderStep('img3', 'done');

            state.currentBook = data;
            state.currentBook.id = Date.now();
            state.currentBook.visual_theme = visual_theme;
            saveBookToHistory(state.currentBook);
            state.currentChapterIndex = 0;
            
            setTimeout(() => {
                elements.panelLoader.style.display = 'none';
                elements.panelReader.style.display = 'flex';
                applyVisualTheme(visual_theme);
                renderChapter();
            }, 1000);

        } catch (e) {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            alert("Falha na geração do livro: " + e.message);
            elements.panelLoader.style.display = 'none';
            elements.panelForm.style.display = 'block';
        }
    };

    // Navigation Page Control
    elements.btnPrevPage.onclick = () => {
        if (state.currentChapterIndex > 0) {
            triggerPageFlipAnimation(() => {
                state.currentChapterIndex--;
                renderChapter();
            });
        }
    };

    elements.btnNextPage.onclick = () => {
        if (state.currentChapterIndex < state.currentBook.chapters.length - 1) {
            triggerPageFlipAnimation(() => {
                state.currentChapterIndex++;
                renderChapter();
            });
        } else {
            alert("Fim da aventura ilustrada! Deseja criar mais histórias?");
        }
    };

    elements.btnNewBook.onclick = () => {
        stopNarration();
        state.currentBook = null;
        elements.panelReader.style.display = 'none';
        elements.panelForm.style.display = 'block';
        document.getElementById('book-theme').value = '';
    };

    // TTS Buttons
    elements.audioPlay.onclick = toggleNarration;

    elements.audioStop.onclick = stopNarration;

    elements.btnAutoPlay.onclick = () => {
        state.autoPlayEnabled = !state.autoPlayEnabled;
        localStorage.setItem('book_autoplay', state.autoPlayEnabled);
        updateAutoPlayUI();
    };

    // Redraw scene trigger modal
    elements.btnReillustrate.onclick = () => {
        elements.redrawPromptInput.value = '';
        elements.redrawLoading.style.display = 'none';
        elements.btnSubmitRedraw.disabled = false;
        elements.modalRedraw.style.display = 'flex';
    };

    const closeRedrawBtn = document.getElementById('btn-close-redraw-modal');
    if (closeRedrawBtn) {
        closeRedrawBtn.onclick = () => {
            elements.modalRedraw.style.display = 'none';
        };
    }

    elements.btnSubmitRedraw.onclick = async () => {
        const prompt = elements.redrawPromptInput.value.trim();
        if (!prompt) {
            alert("Por favor, descreva o que deseja desenhar!");
            return;
        }

        elements.redrawLoading.style.display = 'flex';
        elements.btnSubmitRedraw.disabled = true;

        try {
            const resp = await fetch('/api/book/illustrate-scene', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt })
            });

            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({}));
                throw new Error(errorData.error || "Erro de redesenho.");
            }
            const data = await resp.json();

            state.currentBook.chapters[state.currentChapterIndex].image_url = data.image_url;
            delete state.currentBook.chapters[state.currentChapterIndex].image_error;
            saveBookToHistory(state.currentBook);
            
            elements.readIllustrationImg.className = 'loading';
            const proxySrc = getProxyUrl(data.image_url);
            elements.readIllustrationImg.src = proxySrc;
            elements.readIllustrationImg.style.display = 'block';
            document.getElementById('illustration-error').style.display = 'none';
            elements.readIllustrationImg.onload = () => elements.readIllustrationImg.className = '';

            elements.bookScrollBody.style.backgroundImage = `url("${proxySrc}")`;

            elements.modalRedraw.style.display = 'none';
        } catch (e) {
            alert("Erro ao pintar ilustração: " + e.message);
            if (state.currentBook && state.currentBook.chapters && state.currentBook.chapters[state.currentChapterIndex]) {
                state.currentBook.chapters[state.currentChapterIndex].image_url = null;
                state.currentBook.chapters[state.currentChapterIndex].image_error = e.message;
                saveBookToHistory(state.currentBook);
                renderChapter();
            }
            elements.modalRedraw.style.display = 'none';
        } finally {
            elements.redrawLoading.style.display = 'none';
            elements.btnSubmitRedraw.disabled = false;
        }
    };

    // Close dict bubble on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.word-span') && !e.target.closest('#translation-bubble')) {
            closeTranslationBubble();
        }
    });

    // Session Modal actions
    if (elements.sessionCheckBtn) {
        elements.sessionCheckBtn.onclick = (e) => {
            e.stopPropagation();
            checkStatus();
        };
    }

    elements.openConfigBtn.onclick = () => {
        elements.configError.style.display = 'none';
        elements.configModal.style.display = 'flex';
    };

    elements.closeConfigBtn.onclick = () => {
        elements.configModal.style.display = 'none';
    };

    elements.saveConfigBtn.onclick = async () => {
        const sid = elements.secure1psidInput.value.trim();
        const ts = elements.secure1psidtsInput.value.trim();

        if (!sid || !ts) {
            elements.configError.textContent = 'Preencha ambos os cookies!';
            elements.configError.style.display = 'block';
            return;
        }

        elements.saveConfigBtn.disabled = true;
        elements.saveConfigBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';
        elements.configError.style.display = 'none';

        try {
            const resp = await fetch('/api/save-cookies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secure_1psid: sid, secure_1psidts: ts })
            });
            
            const data = await resp.json();
            if (data.success) {
                elements.configModal.style.display = 'none';
                elements.secure1psidInput.value = '';
                elements.secure1psidtsInput.value = '';
                await checkStatus();
            } else {
                elements.configError.textContent = data.error || 'Erro ao inicializar sessão.';
                elements.configError.style.display = 'block';
            }
        } catch (err) {
            elements.configError.textContent = 'Erro ao enviar dados para o servidor.';
            elements.configError.style.display = 'block';
        } finally {
            elements.saveConfigBtn.disabled = false;
            elements.saveConfigBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar e Autenticar';
        }
    };

    // Opacity Range control
    if (elements.bgOpacityRange) {
        elements.bgOpacityRange.addEventListener('input', (e) => {
            const val = e.target.value;
            updateBgOpacity(val);
            localStorage.setItem('book_bg_opacity', val);
        });
    }

    // Global Lang select change
    document.getElementById('global-lang-select').addEventListener('change', (e) => {
        applyLanguage(e.target.value);
    });

    // Voice Input for Book Theme and Redraw prompt
    if (elements.btnMicBookTheme) {
        const inputTheme = document.getElementById('book-theme');
        if (inputTheme) {
            attachVoiceInput(inputTheme, elements.btnMicBookTheme, () => localStorage.getItem('paradise_language') || 'pt');
        }
    }
    if (elements.btnMicRedraw && elements.redrawPromptInput) {
        attachVoiceInput(elements.redrawPromptInput, elements.btnMicRedraw, () => localStorage.getItem('paradise_language') || 'pt');
    }

    // Video Export Logic for Book
    if (elements.btnExportBookVideo) {
        let mediaRecorder;
        let recordedChunks = [];
        let stopCheckInterval;
        let isExporting = false;
        
        elements.btnExportBookVideo.onclick = async (e) => {
            e.preventDefault();
            if (isExporting) return;
            
            if (!state.currentBook) {
                alert('Nenhum livro gerado para gravar.');
                return;
            }
            
            isExporting = true;
            elements.btnExportBookVideo.disabled = true;
            stopNarration();
            
            try {
                // Request Display Media (Tab audio captures WebAudio/audio tags)
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: "browser" },
                    audio: true,
                    preferCurrentTab: true
                });

                // Prepare video screen (fullscreen)
                const videoArea = elements.panelReader;
                if (videoArea.requestFullscreen) {
                    videoArea.requestFullscreen().catch(e => console.log("Fullscreen could not be automatically initiated:", e));
                }
                
                videoArea.style.cursor = 'none';
                videoArea.classList.add('recording-mode');
                
                recordedChunks = [];
                const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
                mediaRecorder = new MediaRecorder(stream, { mimeType });
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                };
                
                const restoreUI = () => {
                    if (document.fullscreenElement) document.exitFullscreen();
                    videoArea.style.cursor = 'default';
                    videoArea.classList.remove('recording-mode');
                    
                    elements.exportStatusBook.style.display = 'none';
                    elements.btnExportBookVideo.disabled = false;
                    if (stopCheckInterval) clearInterval(stopCheckInterval);
                    
                    stream.getTracks().forEach(t => t.stop());
                };
                
                mediaRecorder.onstop = () => {
                    restoreUI();
                    
                    const blob = new Blob(recordedChunks, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    const safeTitle = (state.currentBook.theme || 'livro').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    a.download = `${safeTitle}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 100);
                };
                
                // Wait a moment for fullscreen animation
                await new Promise(r => setTimeout(r, 1000));

                elements.btnExportBookVideo.disabled = true;
                elements.exportStatusBook.style.display = 'inline-block';
                mediaRecorder.start();
                
                // Enable Auto Play and start from Page 1
                state.autoPlayEnabled = true;
                localStorage.setItem('book_autoplay', state.autoPlayEnabled);
                updateAutoPlayUI();
                
                // Reset to chapter 0 and render
                state.currentChapterIndex = 0;
                import('./player.js').then(module => {
                    module.renderChapter();
                    setTimeout(() => {
                        elements.audioPlay.click();
                    }, 800);
                });
                
                const onBookFinished = () => {
                    setTimeout(() => {
                        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                    }, 2000); // 2 second buffer after speech ends
                    window.removeEventListener('book-finished', onBookFinished);
                };
                window.addEventListener('book-finished', onBookFinished);
                
                stream.getVideoTracks()[0].onended = () => {
                    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                    stopNarration();
                    isExporting = false;
                    elements.btnExportBookVideo.disabled = false;
                    window.removeEventListener('book-finished', onBookFinished);
                };
                
            } catch (err) {
                console.error("Error starting screen record: ", err);
                alert("Falha ao iniciar a gravação. Verifique as permissões.");
                elements.exportStatusBook.style.display = 'none';
                isExporting = false;
                elements.btnExportBookVideo.disabled = false;
            }
        };
    }
}

// Initial configuration loading
document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    checkStatus();
    renderHistoryList();

    // Default Contrast Opacity setup
    const persistedOpacity = localStorage.getItem('book_bg_opacity');
    const defaultOpacity = persistedOpacity !== null ? parseInt(persistedOpacity, 10) : 94;
    if (elements.bgOpacityRange) {
        elements.bgOpacityRange.value = defaultOpacity;
        updateBgOpacity(defaultOpacity);
    }

    // Default Language setup
    const currentLang = localStorage.getItem('paradise_language') || 'pt';
    applyLanguage(currentLang);
});
