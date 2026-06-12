import { state } from './state.js';
import { elements } from './elements.js';
import { classTranslations } from './translations.js';
import { renderHistoryList, saveLessonToHistory } from './history.js';
import {
    loadSlide,
    renderLesson,
    updateAutoPlayUI,
    startSubtitleLoop,
    stopSubtitleLoop,
    formatTime,
    returnToLesson,
    applyBoardVisualSettings
} from './player.js';
import { initializeAvatarHandlers } from './avatar.js';
import { attachVoiceInput } from '../voice_input.js';
import { setupAskTeacher } from './ask.js';
import { setupClassroomExporter } from './exporter.js';

// Check if generate button should be enabled
function checkInputs() {
    let valid = false;
    if (state.currentType === 'theme' && elements.themeInput.value.trim() !== '') {
        valid = true;
    } else if (state.currentType === 'text' && elements.textInput.value.trim() !== '') {
        valid = true;
    } else if (state.currentType === 'pdf' && state.selectedPdfFile !== null) {
        valid = true;
    }
    elements.btnGenerate.disabled = !valid;
}

// PDF selection handler
function handleSelectedFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Apenas arquivos PDF são aceitos!');
        return;
    }
    state.selectedPdfFile = file;
    elements.selectedFilename.textContent = `PDF Selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    elements.selectedFilename.style.display = 'block';
    checkInputs();
}

// Apply Selected Language UI text replacements
export function applyLanguage(lang) {
    localStorage.setItem("paradise_language", lang);
    document.cookie = `paradise_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    
    const t = classTranslations[lang] || classTranslations.pt;
    
    const backBtn = document.getElementById('back-to-panel-btn');
    if (backBtn) backBtn.innerHTML = t.backBtn;
    
    const panelTitle = document.querySelector('.panel-header h2');
    if (panelTitle) panelTitle.textContent = t.panelTitle;
    
    const panelDesc = document.querySelector('.panel-header p');
    if (panelDesc) panelDesc.textContent = t.panelDesc;
    
    if (elements.typeTabs.length >= 3) {
        elements.typeTabs[0].innerHTML = t.tabTheme;
        elements.typeTabs[1].innerHTML = t.tabText;
        elements.typeTabs[2].innerHTML = t.tabPdf;
    }
    
    if (elements.btnGenerate) elements.btnGenerate.innerHTML = t.btnGenerate;
    if (elements.themeInput) elements.themeInput.placeholder = t.themePlaceholder;
    if (elements.textInput) elements.textInput.placeholder = t.textPlaceholder;
    
    const themeLabel = document.querySelector('label[for="theme-input"]');
    if (themeLabel) themeLabel.textContent = t.themeLabel;
    
    const textLabel = document.querySelector('label[for="text-input"]');
    if (textLabel) textLabel.textContent = t.textLabel;
    
    const pdfLabel = document.querySelector('label[for="pdf-file"]');
    if (pdfLabel) pdfLabel.textContent = t.pdfLabel;
    
    const pdfHelp = document.querySelector('.input-group.pdf-group p');
    if (pdfHelp) pdfHelp.textContent = t.pdfHelp;
    
    const langSelect = document.getElementById('global-lang-select');
    if (langSelect) langSelect.value = lang;

    if (elements.lblReservoirTitle) elements.lblReservoirTitle.textContent = t.reservoirTitle;
    if (elements.btnReservoirLabel) elements.btnReservoirLabel.textContent = t.reservoirTitle;
    if (elements.lblAskTitle) elements.lblAskTitle.textContent = t.lblAskTitle;
    if (elements.askTeacherInput) elements.askTeacherInput.placeholder = t.askPlaceholder;
    if (elements.lblBtnAsk) elements.lblBtnAsk.textContent = t.lblBtnAsk;
    if (elements.lblBtnReturn) elements.lblBtnReturn.textContent = t.lblBtnReturn;

    const lblStyleLabel = document.getElementById('lbl-style-label');
    if (lblStyleLabel) lblStyleLabel.textContent = t.lblStyleLabel;
    const optStyleClassic = document.getElementById('opt-style-classic');
    if (optStyleClassic) optStyleClassic.textContent = t.styleClassic;
    const optStyleRealistic = document.getElementById('opt-style-realistic');
    if (optStyleRealistic) optStyleRealistic.textContent = t.styleRealistic;
    const optStyleMedieval = document.getElementById('opt-style-medieval');
    if (optStyleMedieval) optStyleMedieval.textContent = t.styleMedieval;
    const optStyleCaveman = document.getElementById('opt-style-caveman');
    if (optStyleCaveman) optStyleCaveman.textContent = t.styleCaveman;
    const optStyleAnime = document.getElementById('opt-style-anime');
    if (optStyleAnime) optStyleAnime.textContent = t.styleAnime;
    const optStyleDisney = document.getElementById('opt-style-disney');
    if (optStyleDisney) optStyleDisney.textContent = t.styleDisney;

    // Translate new board controls
    const lblLayoutEl = document.querySelector('label[for="board-img-mode-select"]');
    if (lblLayoutEl) lblLayoutEl.innerHTML = `<i class="fa-solid fa-shapes"></i> ${t.lblLayout}`;
    
    const optLayoutSplit = document.querySelector('#board-img-mode-select option[value="split"]');
    if (optLayoutSplit) optLayoutSplit.textContent = t.optLayoutSplit;
    
    const optLayoutBackground = document.querySelector('#board-img-mode-select option[value="background"]');
    if (optLayoutBackground) optLayoutBackground.textContent = t.optLayoutBackground;
    
    const lblAnimationEl = document.querySelector('label[for="board-anim-select"]');
    if (lblAnimationEl) lblAnimationEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${t.lblAnimation}`;
    
    const optAnimNone = document.querySelector('#board-anim-select option[value="none"]');
    if (optAnimNone) optAnimNone.textContent = t.optAnimNone;
    
    const optAnimZoomIn = document.querySelector('#board-anim-select option[value="zoom-in"]');
    if (optAnimZoomIn) optAnimZoomIn.textContent = t.optAnimZoomIn;
    
    const optAnimEntrance = document.querySelector('#board-anim-select option[value="entrance"]');
    if (optAnimEntrance) optAnimEntrance.textContent = t.optAnimEntrance;
    
    const optAnimPulse = document.querySelector('#board-anim-select option[value="pulse"]');
    if (optAnimPulse) optAnimPulse.textContent = t.optAnimPulse;

    updateAutoPlayUI();
    applyBoardVisualSettings();
    renderHistoryList();
}

// Setup Event Listeners
function setupEvents() {
    elements.themeInput.addEventListener('input', checkInputs);
    elements.textInput.addEventListener('input', checkInputs);
    
    // Tab switching
    elements.typeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.typeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentType = tab.getAttribute('data-type');
            
            elements.groupTheme.style.display = state.currentType === 'theme' ? 'flex' : 'none';
            elements.groupText.style.display = state.currentType === 'text' ? 'flex' : 'none';
            elements.groupPdf.style.display = state.currentType === 'pdf' ? 'flex' : 'none';
            
            checkInputs();
        });
    });
    
    // PDF Drag & Drop
    elements.pdfDropZone.addEventListener('click', () => elements.pdfFileInput.click());
    elements.pdfFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });
    
    elements.pdfDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.pdfDropZone.style.borderColor = 'rgba(139, 92, 246, 0.7)';
    });
    
    elements.pdfDropZone.addEventListener('dragleave', () => {
        elements.pdfDropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    });
    
    elements.pdfDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.pdfDropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        if (e.dataTransfer.files.length > 0) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });
    
    // Generate Button Action
    elements.btnGenerate.addEventListener('click', async () => {
        elements.setupPanel.style.display = 'none';
        elements.loadingPanel.style.display = 'flex';
        
        elements.loadingStepTitle.textContent = 'Extraindo e Estruturando...';
        elements.loadingStepDesc.textContent = 'Analisando os conceitos base e separando o roteiro em slides didáticos.';
        
        const formData = new FormData();
        formData.append('type', state.currentType);
        formData.append('language', localStorage.getItem('paradise_language') || 'pt');
        const durationSelect = document.getElementById('classroom-duration');
        if (durationSelect) {
            formData.append('duration', durationSelect.value);
        }
        const styleSelect = document.getElementById('classroom-style');
        if (styleSelect) {
            formData.append('style', styleSelect.value);
        }
        
        if (state.currentType === 'theme') {
            formData.append('content', elements.themeInput.value.trim());
        } else if (state.currentType === 'text') {
            formData.append('content', elements.textInput.value.trim());
        } else if (state.currentType === 'pdf') {
            formData.append('file', state.selectedPdfFile);
            elements.loadingStepTitle.textContent = 'Lendo Documento PDF...';
            elements.loadingStepDesc.textContent = 'Processando páginas e extraindo conteúdo de texto acadêmico.';
        }

        try {
            setTimeout(() => {
                if (elements.loadingPanel.style.display === 'flex') {
                    elements.loadingStepTitle.textContent = 'Ilustrando o Quadro...';
                    elements.loadingStepDesc.textContent = 'Desenhando diagramas técnicos estilizados sobre o assunto no quadro verde.';
                }
            }, 7000);
            
            const resp = await fetch('/api/classroom/generate', {
                method: 'POST',
                body: formData
            });
            
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            
            state.lessonData = await resp.json();
            state.lessonData.id = Date.now();
            state.lessonData.timestamp = new Date().toLocaleString();
            saveLessonToHistory(state.lessonData);
            
            elements.loadingPanel.style.display = 'none';
            elements.stagePanel.style.display = 'flex';
            
            state.currentSlideIdx = 0;
            renderLesson();
        } catch (err) {
            alert(`Falha ao gerar aula: ${err.message || err}`);
            elements.loadingPanel.style.display = 'none';
            elements.setupPanel.style.display = 'flex';
        }
    });
    
    // Reset Action
    elements.btnReset.addEventListener('click', () => {
        elements.audioEl.pause();
        elements.audioEl.src = '';
        elements.teacherAvatar.classList.remove('speaking');
        window.isSpeaking3D = false;
        state.isPlaying = false;
        stopSubtitleLoop();
        
        localStorage.removeItem('paradise_active_lesson');
        localStorage.removeItem('paradise_active_lesson_slide');
        
        state.explanationActive = false;
        if (elements.btnReturnLesson) elements.btnReturnLesson.style.display = 'none';
        
        elements.stagePanel.style.display = 'none';
        elements.setupPanel.style.display = 'flex';
        
        elements.themeInput.value = '';
        elements.textInput.value = '';
        state.selectedPdfFile = null;
        elements.pdfFileInput.value = '';
        elements.selectedFilename.style.display = 'none';
        elements.btnGenerate.disabled = true;
    });
    
    // Audio Player Controls
    elements.btnPlay.addEventListener('click', () => {
        if (state.audioLoading) return;
        
        if (elements.audioEl.paused) {
            elements.audioEl.play();
            elements.playIcon.className = 'fa-solid fa-pause';
            elements.teacherAvatar.classList.add('speaking');
            window.isSpeaking3D = true;
            state.isPlaying = true;
            startSubtitleLoop();
        } else {
            elements.audioEl.pause();
            elements.playIcon.className = 'fa-solid fa-play';
            elements.teacherAvatar.classList.remove('speaking');
            window.isSpeaking3D = false;
            state.isPlaying = false;
            stopSubtitleLoop();
        }
    });
    
    elements.btnPrev.addEventListener('click', () => {
        if (state.currentSlideIdx > 0) {
            state.currentSlideIdx--;
            loadSlide(state.currentSlideIdx);
        }
    });
    
    elements.btnNext.addEventListener('click', () => {
        if (state.lessonData && state.currentSlideIdx < state.lessonData.slides.length - 1) {
            state.currentSlideIdx++;
            loadSlide(state.currentSlideIdx);
        }
    });
    
    elements.btnAutoPlay.addEventListener('click', () => {
        state.autoPlayEnabled = !state.autoPlayEnabled;
        localStorage.setItem('classroom_autoplay', state.autoPlayEnabled);
        updateAutoPlayUI();
    });
    
    // Timeline Seek progress bar input
    elements.progressBar.addEventListener('input', () => {
        if (elements.audioEl.duration) {
            const pct = elements.progressBar.value;
            elements.audioEl.currentTime = (pct / 100) * elements.audioEl.duration;
        }
    });
    
    // Audio time progression events
    elements.audioEl.addEventListener('timeupdate', () => {
        if (elements.audioEl.duration) {
            const current = elements.audioEl.currentTime;
            const duration = elements.audioEl.duration;
            state.audioDuration = duration;
            
            const pct = (current / duration) * 100;
            elements.progressBar.value = pct;
            
            elements.currentTimeEl.textContent = formatTime(current);
            elements.durationTimeEl.textContent = formatTime(duration);
        }
    });
    
    elements.audioEl.addEventListener('ended', () => {
        elements.teacherAvatar.classList.remove('speaking');
        window.isSpeaking3D = false;
        state.isPlaying = false;
        stopSubtitleLoop();
        elements.playIcon.className = 'fa-solid fa-play';
        
        // Auto transition
        if (!state.explanationActive && state.autoPlayEnabled && state.lessonData && state.currentSlideIdx < state.lessonData.slides.length - 1) {
            const endedSlideIdx = state.currentSlideIdx;
            setTimeout(() => {
                if (state.autoPlayEnabled && state.currentSlideIdx === endedSlideIdx) {
                    state.currentSlideIdx++;
                    loadSlide(state.currentSlideIdx);
                }
            }, 2000);
        }
    });
    
    // Speed Slider changes
    elements.speedSlider.addEventListener('input', () => {
        const speed = elements.speedSlider.value / 10;
        elements.speedLabel.textContent = `Velocidade: ${speed.toFixed(1)}x`;
        elements.audioEl.playbackRate = speed;
    });

    // Image Mode Selector
    if (elements.boardImgModeSelect) {
        elements.boardImgModeSelect.addEventListener('change', (e) => {
            state.imageMode = e.target.value;
            localStorage.setItem('classroom_image_mode', state.imageMode);
            applyBoardVisualSettings();
        });
    }

    // Animation Style Selector
    if (elements.boardAnimSelect) {
        elements.boardAnimSelect.addEventListener('change', (e) => {
            state.animationStyle = e.target.value;
            localStorage.setItem('classroom_animation_style', state.animationStyle);
            applyBoardVisualSettings();
        });
    }
    
    // Language dropdown selection
    document.getElementById('global-lang-select').addEventListener('change', (e) => {
        applyLanguage(e.target.value);
    });

    // Reservoir sidebar open/close
    if (elements.openReservoirBtn) {
        elements.openReservoirBtn.addEventListener('click', () => {
            elements.reservoirSidebar.classList.add('active');
            elements.reservoirOverlay.classList.add('active');
        });
    }
    if (elements.closeReservoirBtn) {
        elements.closeReservoirBtn.addEventListener('click', () => {
            elements.reservoirSidebar.classList.remove('active');
            elements.reservoirOverlay.classList.remove('active');
        });
    }
    if (elements.reservoirOverlay) {
        elements.reservoirOverlay.addEventListener('click', () => {
            elements.reservoirSidebar.classList.remove('active');
            elements.reservoirOverlay.classList.remove('active');
        });
    }

    // Ask the Teacher — delegated to ask.js
    setupAskTeacher();

    if (elements.btnReturnLesson) {
        elements.btnReturnLesson.addEventListener('click', returnToLesson);
    }

    // Attach Voice Input to Theme and Ask Teacher input fields
    if (elements.btnMicTheme && elements.themeInput) {
        attachVoiceInput(elements.themeInput, elements.btnMicTheme, () => localStorage.getItem('paradise_language') || 'pt');
        // Trigger validation check on input change via voice
        elements.themeInput.addEventListener('change', checkInputs);
    }
    if (elements.btnMicAsk && elements.askTeacherInput) {
        attachVoiceInput(elements.askTeacherInput, elements.btnMicAsk, () => localStorage.getItem('paradise_language') || 'pt');
    }
    if (elements.btnMicText && elements.textInput) {
        attachVoiceInput(elements.textInput, elements.btnMicText, () => localStorage.getItem('paradise_language') || 'pt');
        elements.textInput.addEventListener('change', checkInputs);
    }

    // Video Export — delegated to exporter.js
    setupClassroomExporter();
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Enable 3D avatar reference globally
    window.isSpeaking3D = false;

    // Bind event listeners
    setupEvents();
    
    // Initialize profile/avatar handlers
    initializeAvatarHandlers();
    
    // Apply default language settings
    const currentLang = localStorage.getItem('paradise_language') || 'pt';
    applyLanguage(currentLang);
});
