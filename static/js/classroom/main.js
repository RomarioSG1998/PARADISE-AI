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
    formatTime
} from './player.js';
import { initializeAvatarHandlers } from './avatar.js';

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

    const lblSavedClasses = document.getElementById('lbl-saved-classes');
    if (lblSavedClasses) lblSavedClasses.textContent = t.lblSavedClasses;
    const descSavedClasses = document.getElementById('desc-saved-classes');
    if (descSavedClasses) descSavedClasses.textContent = t.descSavedClasses;

    updateAutoPlayUI();
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
        if (state.autoPlayEnabled && state.lessonData && state.currentSlideIdx < state.lessonData.slides.length - 1) {
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
    
    // Language dropdown selection
    document.getElementById('global-lang-select').addEventListener('change', (e) => {
        applyLanguage(e.target.value);
    });
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
    
    // Load persisted state if exists
    const activeLessonData = localStorage.getItem('paradise_active_lesson');
    if (activeLessonData) {
        try {
            const parsed = JSON.parse(activeLessonData);
            if (parsed && parsed.slides && parsed.slides.length > 0) {
                state.lessonData = parsed;
                const savedSlideIdx = parseInt(localStorage.getItem('paradise_active_lesson_slide') || '0', 10);
                state.currentSlideIdx = isNaN(savedSlideIdx) ? 0 : savedSlideIdx;
                elements.setupPanel.style.display = 'none';
                elements.stagePanel.style.display = 'flex';
                renderLesson();
            }
        } catch(e) {
            localStorage.removeItem('paradise_active_lesson');
            localStorage.removeItem('paradise_active_lesson_slide');
        }
    }
});
