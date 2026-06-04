let isSpeaking3D = false;

// DOM Elements
const setupPanel = document.getElementById('setup-panel');
const loadingPanel = document.getElementById('loading-panel');
const stagePanel = document.getElementById('stage-panel');
const typeTabs = document.querySelectorAll('.type-tab');

const groupTheme = document.getElementById('group-theme');
const groupText = document.getElementById('group-text');
const groupPdf = document.getElementById('group-pdf');

const themeInput = document.getElementById('theme-input');
const textInput = document.getElementById('text-input');
const pdfFileInput = document.getElementById('pdf-file-input');
const pdfDropZone = document.getElementById('pdf-drop-zone');
const selectedFilename = document.getElementById('selected-filename');

const btnGenerate = document.getElementById('btn-generate-lesson');
const btnReset = document.getElementById('btn-reset-classroom');
const loadingStepTitle = document.getElementById('loading-step-title');
const loadingStepDesc = document.getElementById('loading-step-desc');

// Stage Elements
const classroomSubjectTitle = document.getElementById('classroom-subject-title');
const boardSlideTitle = document.getElementById('board-slide-title');
const boardBullets = document.getElementById('board-bullets');
const boardImage = document.getElementById('board-image');
const teacherAvatar = document.getElementById('teacher-avatar');
const teleprompterSubtitles = document.getElementById('teleprompter-subtitles');

// Control Bar Elements
const btnPlay = document.getElementById('btn-play-audio');
const playIcon = document.getElementById('play-icon');
const btnPrev = document.getElementById('btn-prev-slide');
const btnNext = document.getElementById('btn-next-slide');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationTimeEl = document.getElementById('duration-time');
const speedSlider = document.getElementById('speed-slider');
const speedLabel = document.getElementById('speed-label');
const slideIndicator = document.getElementById('slide-indicator');
const btnAutoPlay = document.getElementById('btn-auto-play');
const autoPlayIcon = document.getElementById('auto-play-icon');

const audioEl = document.getElementById('lesson-audio');

// State Variables
let currentType = 'theme'; // theme, text, pdf
let selectedPdfFile = null;
let lessonData = null; // Generated classroom data
let currentSlideIdx = 0;
let audioDuration = 0;
let audioLoading = false;
let autoPlayEnabled = localStorage.getItem('classroom_autoplay') !== 'false';

let wordRanges = [];
let isPlaying = false;
let animationFrameId = null;

// Check if generate button should be enabled
function checkInputs() {
    let valid = false;
    if (currentType === 'theme' && themeInput.value.trim() !== '') {
        valid = true;
    } else if (currentType === 'text' && textInput.value.trim() !== '') {
        valid = true;
    } else if (currentType === 'pdf' && selectedPdfFile !== null) {
        valid = true;
    }
    btnGenerate.disabled = !valid;
}

themeInput.addEventListener('input', checkInputs);
textInput.addEventListener('input', checkInputs);

// Tab selection change
typeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        typeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentType = tab.getAttribute('data-type');
        
        // Toggle forms
        groupTheme.style.display = currentType === 'theme' ? 'flex' : 'none';
        groupText.style.display = currentType === 'text' ? 'flex' : 'none';
        groupPdf.style.display = currentType === 'pdf' ? 'flex' : 'none';
        
        checkInputs();
    });
});

// PDF Drag and Drop Events
pdfDropZone.addEventListener('click', () => pdfFileInput.click());
pdfFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleSelectedFile(e.target.files[0]);
    }
});

pdfDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    pdfDropZone.style.borderColor = 'rgba(139, 92, 246, 0.7)';
});

pdfDropZone.addEventListener('dragleave', () => {
    pdfDropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
});

pdfDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfDropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    if (e.dataTransfer.files.length > 0) {
        handleSelectedFile(e.dataTransfer.files[0]);
    }
});

function handleSelectedFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Apenas arquivos PDF são aceitos!');
        return;
    }
    selectedPdfFile = file;
    selectedFilename.textContent = `PDF Selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    selectedFilename.style.display = 'block';
    checkInputs();
}

// Generate Lesson
btnGenerate.addEventListener('click', async () => {
    setupPanel.style.display = 'none';
    loadingPanel.style.display = 'flex';
    
    // Set loading step texts
    loadingStepTitle.textContent = 'Extraindo e Estruturando...';
    loadingStepDesc.textContent = 'Analisando os conceitos base e separando o roteiro em slides didáticos.';
    
    const formData = new FormData();
    formData.append('type', currentType);
    formData.append('language', localStorage.getItem('paradise_language') || 'pt');
    
    if (currentType === 'theme') {
        formData.append('content', themeInput.value.trim());
    } else if (currentType === 'text') {
        formData.append('content', textInput.value.trim());
    } else if (currentType === 'pdf') {
        formData.append('file', selectedPdfFile);
        loadingStepTitle.textContent = 'Lendo Documento PDF...';
        loadingStepDesc.textContent = 'Processando páginas e extraindo conteúdo de texto acadêmico.';
    }

    try {
        // Change description step slightly in progress
        setTimeout(() => {
            if (loadingPanel.style.display === 'flex') {
                loadingStepTitle.textContent = 'Ilustrando o Quadro...';
                loadingStepDesc.textContent = 'Desenhando diagramas técnicos estilizados sobre o assunto no quadro verde.';
            }
        }, 7000);
        
        const resp = await fetch('/api/classroom/generate', {
            method: 'POST',
            body: formData
        });
        
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        
        lessonData = await resp.json();
        lessonData.id = Date.now();
        lessonData.timestamp = new Date().toLocaleString();
        saveLessonToHistory(lessonData);
        
        // Success - render the lesson!
        loadingPanel.style.display = 'none';
        stagePanel.style.display = 'flex';
        
        currentSlideIdx = 0;
        renderLesson();
    } catch (err) {
        alert(`Falha ao gerar aula: ${err.message || err}`);
        loadingPanel.style.display = 'none';
        setupPanel.style.display = 'flex';
    }
});

// Reset Classroom
btnReset.addEventListener('click', () => {
    // Stop audio
    audioEl.pause();
    audioEl.src = '';
    teacherAvatar.classList.remove('speaking');
    isSpeaking3D = false;
    isPlaying = false;
    stopSubtitleLoop();
    
    localStorage.removeItem('paradise_active_lesson');
    localStorage.removeItem('paradise_active_lesson_slide');
    
    stagePanel.style.display = 'none';
    setupPanel.style.display = 'flex';
    
    // Clear fields
    themeInput.value = '';
    textInput.value = '';
    selectedPdfFile = null;
    pdfFileInput.value = '';
    selectedFilename.style.display = 'none';
    btnGenerate.disabled = true;
});

// Play/Pause Audio
btnPlay.addEventListener('click', () => {
    if (audioLoading) return;
    
    if (audioEl.paused) {
        audioEl.play();
        playIcon.className = 'fa-solid fa-pause';
        teacherAvatar.classList.add('speaking');
        isSpeaking3D = true;
        isPlaying = true;
        startSubtitleLoop();
    } else {
        audioEl.pause();
        playIcon.className = 'fa-solid fa-play';
        teacherAvatar.classList.remove('speaking');
        isSpeaking3D = false;
        isPlaying = false;
        stopSubtitleLoop();
    }
});

// Change slide page
btnPrev.addEventListener('click', () => {
    if (currentSlideIdx > 0) {
        currentSlideIdx--;
        loadSlide(currentSlideIdx);
    }
});

btnNext.addEventListener('click', () => {
    if (lessonData && currentSlideIdx < lessonData.slides.length - 1) {
        currentSlideIdx++;
        loadSlide(currentSlideIdx);
    }
});

btnAutoPlay.addEventListener('click', () => {
    autoPlayEnabled = !autoPlayEnabled;
    localStorage.setItem('classroom_autoplay', autoPlayEnabled);
    updateAutoPlayUI();
});

function updateAutoPlayUI() {
    const lang = localStorage.getItem('paradise_language') || 'pt';
    const t = classTranslations[lang] || classTranslations.pt;
    if (autoPlayEnabled) {
        btnAutoPlay.title = t.autoPlayActive || "Reprodução Automática: Ativada";
        autoPlayIcon.className = "fa-solid fa-toggle-on";
        btnAutoPlay.style.color = "#a78bfa";
        btnAutoPlay.style.borderColor = "rgba(167, 139, 250, 0.6)";
        btnAutoPlay.style.boxShadow = "0 0 10px rgba(167, 139, 250, 0.4)";
    } else {
        btnAutoPlay.title = t.autoPlayInactive || "Reprodução Automática: Desativada";
        autoPlayIcon.className = "fa-solid fa-toggle-off";
        btnAutoPlay.style.color = "var(--text-secondary)";
        btnAutoPlay.style.borderColor = "rgba(255, 255, 255, 0.08)";
        btnAutoPlay.style.boxShadow = "none";
    }
}

// Saved Lessons Persistence History Logic
function getSavedLessons() {
    const data = localStorage.getItem('paradise_lessons');
    if (data) {
        try {
            return JSON.parse(data) || [];
        } catch(e) {
            return [];
        }
    }
    return [];
}

def_val = null;

function saveLessonToHistory(lesson) {
    let lessons = getSavedLessons();
    if (!lesson.id) {
        lesson.id = Date.now();
    }
    if (!lesson.timestamp) {
        lesson.timestamp = new Date().toLocaleString();
    }
    const idx = lessons.findIndex(l => l.id === lesson.id);
    if (idx !== -1) {
        lessons[idx] = lesson;
    } else {
        lessons.unshift(lesson);
    }
    if (lessons.length > 10) {
        lessons = lessons.slice(0, 10);
    }
    localStorage.setItem('paradise_lessons', JSON.stringify(lessons));
    renderHistoryList();
}

function deleteLessonFromHistory(lessonId, event) {
    if (event) event.stopPropagation();
    const lang = localStorage.getItem('paradise_language') || 'pt';
    const t = classTranslations[lang] || classTranslations.pt;
    const confirmMsg = t.deleteClassConfirm || "Tem certeza que deseja excluir esta aula do seu histórico?";
    if (!confirm(confirmMsg)) return;
    
    let lessons = getSavedLessons();
    lessons = lessons.filter(l => l.id !== lessonId);
    localStorage.setItem('paradise_lessons', JSON.stringify(lessons));
    renderHistoryList();
}

function loadLessonFromHistory(lessonId) {
    const lessons = getSavedLessons();
    const lesson = lessons.find(l => l.id === lessonId);
    if (lesson) {
        lessonData = lesson;
        currentSlideIdx = 0;
        setupPanel.style.display = 'none';
        stagePanel.style.display = 'flex';
        renderLesson();
    }
}

function renderHistoryList() {
    const historyPanel = document.getElementById('history-panel');
    const historyList = document.getElementById('history-list');
    if (!historyPanel || !historyList) return;
    
    const lessons = getSavedLessons();
    if (lessons.length === 0) {
        historyPanel.style.display = 'none';
        return;
    }
    
    const lang = localStorage.getItem('paradise_language') || 'pt';
    const t = classTranslations[lang] || classTranslations.pt;
    const slideCountText = t.slideCountText || "slides";
    const themeLabel = t.themeText || "Tema";
    
    historyPanel.style.display = 'block';
    historyList.innerHTML = '';
    
    lessons.forEach(lesson => {
        const card = document.createElement('div');
        card.style.padding = '1.25rem';
        card.style.background = 'var(--bg-surface)';
        card.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        card.style.borderRadius = '14px';
        card.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.15)';
        card.style.cursor = 'pointer';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.5rem';
        card.style.transition = 'all 0.2s ease-in-out';
        
        card.onmouseenter = () => {
            card.style.transform = 'translateY(-3px)';
            card.style.borderColor = 'rgba(167, 139, 250, 0.3)';
            card.style.boxShadow = '0 15px 30px rgba(167, 139, 250, 0.08)';
        };
        card.onmouseleave = () => {
            card.style.transform = 'none';
            card.style.borderColor = 'rgba(255, 255, 255, 0.05)';
            card.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.15)';
        };
        
        card.onclick = () => loadLessonFromHistory(lesson.id);
        
        const title = document.createElement('h4');
        title.style.fontSize = '1.05rem';
        title.style.fontWeight = '600';
        title.style.color = '#f8fafc';
        title.style.margin = '0';
        title.style.lineHeight = '1.3';
        title.textContent = lesson.subject || "Aula sem título";
        
        const meta = document.createElement('div');
        meta.style.fontSize = '0.8rem';
        meta.style.color = 'var(--text-secondary)';
        meta.style.display = 'flex';
        meta.style.gap = '0.5rem';
        meta.innerHTML = `<span style="color: #a78bfa;">${lesson.slides ? lesson.slides.length : 0} ${slideCountText}</span> · <span>${lesson.timestamp || ''}</span>`;
        
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';
        footer.style.alignItems = 'center';
        footer.style.marginTop = '0.5rem';
        footer.style.gap = '0.5rem';
        
        const originLabel = document.createElement('span');
        originLabel.style.fontSize = '0.75rem';
        originLabel.style.color = 'rgba(255, 255, 255, 0.4)';
        originLabel.textContent = `${themeLabel}: ${lesson.subject || ''}`;
        originLabel.style.whiteSpace = 'nowrap';
        originLabel.style.overflow = 'hidden';
        originLabel.style.textOverflow = 'ellipsis';
        originLabel.style.maxWidth = '180px';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.style.background = 'rgba(239, 68, 68, 0.1)';
        deleteBtn.style.border = '1px solid rgba(239, 68, 68, 0.2)';
        deleteBtn.style.color = '#ef4444';
        deleteBtn.style.padding = '0.35rem 0.65rem';
        deleteBtn.style.fontSize = '0.8rem';
        deleteBtn.style.borderRadius = '6px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.transition = 'all 0.15s';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        
        deleteBtn.onmouseenter = () => {
            deleteBtn.style.background = 'rgba(239, 68, 68, 0.2)';
        };
        deleteBtn.onmouseleave = () => {
            deleteBtn.style.background = 'rgba(239, 68, 68, 0.1)';
        };
        
        deleteBtn.onclick = (e) => deleteLessonFromHistory(lesson.id, e);
        
        footer.appendChild(originLabel);
        footer.appendChild(deleteBtn);
        
        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(footer);
        
        historyList.appendChild(card);
    });
}

// Set Slide Content
function renderLesson() {
    if (!lessonData) return;
    classroomSubjectTitle.textContent = lessonData.subject || "Aula Paradise AI";
    localStorage.setItem('paradise_active_lesson', JSON.stringify(lessonData));
    loadSlide(currentSlideIdx);
}

async function loadSlide(idx) {
    if (!lessonData || !lessonData.slides || idx < 0 || idx >= lessonData.slides.length) return;
    localStorage.setItem('paradise_active_lesson_slide', idx);
    
    const slide = lessonData.slides[idx];
    
    // UI Navigation availability
    btnPrev.disabled = idx === 0;
    btnNext.disabled = idx === lessonData.slides.length - 1;
    slideIndicator.textContent = `Slide ${idx + 1} / ${lessonData.slides.length}`;
    
    // Render text
    boardSlideTitle.textContent = `${idx + 1}. ${slide.title}`;
    
    // Split narration and calculate character-weighted ranges
    const words = slide.narration.split(' ');
    let totalChars = words.reduce((acc, w) => acc + w.length, 0);
    let currentSum = 0;
    wordRanges = words.map(w => {
        let start = currentSum / totalChars;
        currentSum += w.length;
        let end = currentSum / totalChars;
        return { start, end };
    });
    
    teleprompterSubtitles.innerHTML = words.map((w, wIdx) => `<span class="sub-word" id="word-${wIdx}">${w}</span>`).join(' ');
    
    // Render bullet points
    boardBullets.innerHTML = '';
    slide.bullets.forEach((bullet, i) => {
        const li = document.createElement('li');
        li.textContent = bullet;
        boardBullets.appendChild(li);
        // Stagger reveal animation for chalk board bullet points
        setTimeout(() => {
            li.classList.add('reveal');
        }, i * 600 + 400);
    });
    
    // Render green chalkboard drawing
    boardImage.className = 'loading';
    const dlBtn = document.getElementById('btn-download-board-img');
    dlBtn.style.display = 'none';
    if (slide.image_url) {
        let rawUrl = slide.image_url;
        let proxyUrl = rawUrl;
        if (rawUrl && (rawUrl.includes("googleusercontent.com") || rawUrl.includes("google.com"))) {
            proxyUrl = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
        }
        
        boardImage.src = proxyUrl;
        boardImage.onclick = () => window.open(rawUrl, '_blank');
        boardImage.style.cursor = 'pointer';
        boardImage.onload = () => {
            boardImage.className = '';
            dlBtn.href = proxyUrl;
            dlBtn.style.display = 'flex';
        };
    } else {
        boardImage.src = '';
    }
    
    // Reset Audio
    audioEl.pause();
    audioEl.src = '';
    teacherAvatar.classList.remove('speaking');
    isSpeaking3D = false;
    isPlaying = false;
    stopSubtitleLoop();
    playIcon.className = 'fa-solid fa-play';
    progressBar.value = 0;
    currentTimeEl.textContent = '0:00';
    durationTimeEl.textContent = '0:00';
    
    // Fetch Audio
    audioLoading = true;
    btnPlay.disabled = true;
    teleprompterSubtitles.innerHTML = `<span style="color: var(--text-secondary); font-style: italic;">Preparando a voz do professor para este quadro...</span>`;
    
    try {
        // Synthesize the narration text using standard proxy TTS
        const globalLang = localStorage.getItem('paradise_language') || 'pt';
        audioEl.src = `/api/tts?text=${encodeURIComponent(slide.narration)}&lang=${globalLang}`;
        audioEl.load();
        
        audioEl.oncanplaythrough = () => {
            audioLoading = false;
            btnPlay.disabled = false;
            
            // Restore words
            teleprompterSubtitles.innerHTML = words.map((w, wIdx) => `<span class="sub-word" id="word-${wIdx}">${w}</span>`).join(' ');
            
            // Set speed rate
            const speed = speedSlider.value / 10;
            audioEl.playbackRate = speed;
            
            // Auto-start play when slide loaded
            audioEl.play().then(() => {
                playIcon.className = 'fa-solid fa-pause';
                teacherAvatar.classList.add('speaking');
                isSpeaking3D = true;
                isPlaying = true;
                startSubtitleLoop();
            }).catch(() => {
                // Browser blocked autoplay, wait for user
                playIcon.className = 'fa-solid fa-play';
                teacherAvatar.classList.remove('speaking');
                isSpeaking3D = false;
                isPlaying = false;
            });
        };
    } catch (e) {
        console.error("Failed to load audio for slide", e);
        teleprompterSubtitles.textContent = slide.narration + " (Áudio indisponível)";
        audioLoading = false;
    }
}

// Teleprompter Word Highlighting Real-Time Loop
function updateSubtitlesHighlight() {
    if (!audioEl.duration) return;
    const current = audioEl.currentTime;
    const duration = audioEl.duration;
    const ratio = current / duration;
    
    let activeIdx = -1;
    for (let i = 0; i < wordRanges.length; i++) {
        if (ratio >= wordRanges[i].start && ratio < wordRanges[i].end) {
            activeIdx = i;
            break;
        }
    }
    if (activeIdx === -1 && ratio >= 0.99) {
        activeIdx = wordRanges.length - 1;
    }
    
    const spans = teleprompterSubtitles.querySelectorAll('.sub-word');
    spans.forEach((span, idx) => {
        if (idx === activeIdx) {
            span.classList.add('highlighted');
            // Smooth centered alignment scroll inside teleprompter panel
            span.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } else {
            span.classList.remove('highlighted');
        }
    });
}

function startSubtitleLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    function loop() {
        updateSubtitlesHighlight();
        if (isPlaying) {
            animationFrameId = requestAnimationFrame(loop);
        }
    }
    animationFrameId = requestAnimationFrame(loop);
}

function stopSubtitleLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Timeline Progress updates
audioEl.addEventListener('timeupdate', () => {
    if (audioEl.duration) {
        const current = audioEl.currentTime;
        const duration = audioEl.duration;
        audioDuration = duration;
        
        const pct = (current / duration) * 100;
        progressBar.value = pct;
        
        currentTimeEl.textContent = formatTime(current);
        durationTimeEl.textContent = formatTime(duration);
    }
});

// On audio end, auto transition
audioEl.addEventListener('ended', () => {
    teacherAvatar.classList.remove('speaking');
    isSpeaking3D = false;
    isPlaying = false;
    stopSubtitleLoop();
    playIcon.className = 'fa-solid fa-play';
    
    // Auto transition to next slide after 2 seconds if available and autoplay is enabled
    if (autoPlayEnabled && lessonData && currentSlideIdx < lessonData.slides.length - 1) {
        setTimeout(() => {
            // Check that we didn't play another slide or restarted or disabled autoplay in between
            if (autoPlayEnabled && audioEl.paused && !audioEl.currentTime) {
                currentSlideIdx++;
                loadSlide(currentSlideIdx);
            }
        }, 2000);
    }
});

// Seek Audio progress
progressBar.addEventListener('input', () => {
    if (audioEl.duration) {
        const pct = progressBar.value;
        audioEl.currentTime = (pct / 100) * audioEl.duration;
    }
});

// Speed Slider changes
speedSlider.addEventListener('input', () => {
    const speed = speedSlider.value / 10;
    speedLabel.textContent = `Velocidade: ${speed.toFixed(1)}x`;
    audioEl.playbackRate = speed;
});

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Editable Avatar Name and Custom Photo Upload Persistence (LocalStorage)
const roleNameEl = document.getElementById('teacher-role-name');
const avatarUpload = document.getElementById('avatar-upload');
const avatarDisplayImg = document.getElementById('avatar-display-img');

// Load persisted avatar name and image from localStorage
const savedName = localStorage.getItem('classroom_avatar_name');
if (savedName) {
    roleNameEl.textContent = savedName;
}

const savedImg = localStorage.getItem('classroom_avatar_image');
if (savedImg) {
    avatarDisplayImg.src = savedImg;
}

// Save name on blur/lose focus
roleNameEl.addEventListener('blur', () => {
    const newName = roleNameEl.textContent.trim();
    if (newName) {
        localStorage.setItem('classroom_avatar_name', newName);
    } else {
        roleNameEl.textContent = 'Professor IA';
    }
});

// Trigger blur when pressing Enter key on editable name
roleNameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        roleNameEl.blur();
    }
});

// Handle profile photo upload and convert to base64 DataURL
avatarUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            avatarDisplayImg.src = dataUrl;
            localStorage.setItem('classroom_avatar_image', dataUrl);
        };
        reader.readAsDataURL(file);
    }
});

// Fullscreen Board Image Hover Zoom Event Listeners
const boardImg = document.getElementById('board-image');
const fsOverlay = document.getElementById('board-image-fullscreen-overlay');
const fsOverlayImg = document.getElementById('fullscreen-overlay-img');

boardImg.addEventListener('mouseenter', () => {
    // Only trigger if image is loaded and is not a blank slide
    if (boardImg.src && !boardImg.src.endsWith('/classroom') && boardImg.style.display !== 'none' && !boardImg.className.includes('loading')) {
        fsOverlayImg.src = boardImg.src;
        fsOverlay.classList.add('active');
    }
});

fsOverlay.addEventListener('mousemove', (e) => {
    const rect = fsOverlayImg.getBoundingClientRect();
    // Close if mouse moves outside the bounds of the image (plus 20px padding buffer)
    if (
        e.clientX < rect.left - 20 ||
        e.clientX > rect.right + 20 ||
        e.clientY < rect.top - 20 ||
        e.clientY > rect.bottom + 20
    ) {
        fsOverlay.classList.remove('active');
    }
});

// Allow closing by clicking anywhere on the overlay
fsOverlay.addEventListener('click', () => {
    fsOverlay.classList.remove('active');
});

// Global Language Selection & UI Translation System
const classTranslations = {
    pt: {
        backBtn: "<i class='fa-solid fa-arrow-left'></i> Painel Geral",
        panelTitle: "Crie sua Aula Inteligente",
        panelDesc: "Estruture uma explicação interativa e ilustrada utilizando a Inteligência Artificial",
        tabTheme: "<i class='fa-solid fa-wand-magic-sparkles'></i> Tema/Assunto",
        tabText: "<i class='fa-solid fa-paragraph'></i> Texto Manual",
        tabPdf: "<i class='fa-solid fa-file-pdf'></i> Arquivo PDF",
        btnGenerate: "<i class='fa-solid fa-graduation-cap'></i> Gerar Aula com IA",
        themePlaceholder: "Ex: Como funciona a fotossíntese?, A história da internet, etc.",
        textPlaceholder: "Cole o texto da sua aula aqui para que a IA crie a explicação em slides...",
        themeLabel: "Digite o Tema ou Assunto",
        textLabel: "Texto Completo da Aula",
        pdfLabel: "Selecione o Arquivo PDF",
        pdfHelp: "O sistema extrairá o texto de todas as páginas do PDF para estruturar os slides da aula.",
        autoPlayActive: "Reprodução Automática: Ativada",
        autoPlayInactive: "Reprodução Automática: Desativada",
        lblSavedClasses: "Suas Aulas Salvas",
        descSavedClasses: "Clique para assistir novamente qualquer uma das aulas já geradas neste navegador.",
        deleteClassConfirm: "Tem certeza que deseja excluir esta aula do seu histórico?",
        slideCountText: "slides",
        themeText: "Tema"
    },
    en: {
        backBtn: "<i class='fa-solid fa-arrow-left'></i> General Dashboard",
        panelTitle: "Create your Smart Class",
        panelDesc: "Structure an interactive and illustrated explanation using Artificial Intelligence",
        tabTheme: "<i class='fa-solid fa-wand-magic-sparkles'></i> Theme/Subject",
        tabText: "<i class='fa-solid fa-paragraph'></i> Manual Text",
        tabPdf: "<i class='fa-solid fa-file-pdf'></i> PDF File",
        btnGenerate: "<i class='fa-solid fa-graduation-cap'></i> Generate Class with AI",
        themePlaceholder: "E.g. How photosynthesis works, The history of the internet, etc.",
        textPlaceholder: "Paste your class text here for the AI to structure the slides...",
        themeLabel: "Type the Theme or Subject",
        textLabel: "Full Class Text",
        pdfLabel: "Select PDF File",
        pdfHelp: "The system will extract text from all PDF pages to structure the classroom slides.",
        autoPlayActive: "Autoplay: Enabled",
        autoPlayInactive: "Autoplay: Disabled",
        lblSavedClasses: "Your Saved Classes",
        descSavedClasses: "Click to watch again any of the classes already generated in this browser.",
        deleteClassConfirm: "Are you sure you want to delete this class from your history?",
        slideCountText: "slides",
        themeText: "Theme"
    },
    es: {
        backBtn: "<i class='fa-solid fa-arrow-left'></i> Panel General",
        panelTitle: "Cree su Aula Inteligente",
        panelDesc: "Estructura una explicación interactiva e ilustrada utilizando Inteligencia Artificial",
        tabTheme: "<i class='fa-solid fa-wand-magic-sparkles'></i> Tema/Asunto",
        tabText: "<i class='fa-solid fa-paragraph'></i> Texto Manual",
        tabPdf: "<i class='fa-solid fa-file-pdf'></i> Archivo PDF",
        btnGenerate: "<i class='fa-solid fa-graduation-cap'></i> Generar Clase con IA",
        themePlaceholder: "Ej: ¿Cómo funciona la fotosíntesis?, La historia de internet, etc.",
        textPlaceholder: "Pegue el texto de su clase aquí para que la IA estructure las diapositivas...",
        themeLabel: "Escriba el Tema o Asunto",
        textLabel: "Texto Completo de la Clase",
        pdfLabel: "Seleccione el Archivo PDF",
        pdfHelp: "El sistema extraerá el texto de todas as páginas del PDF para estructurar las diapositivas de la clase.",
        autoPlayActive: "Reproducción Automática: Activada",
        autoPlayInactive: "Reproducción Automática: Desactivada",
        lblSavedClasses: "Sus Clases Guardadas",
        descSavedClasses: "Haga clic para ver nuevamente cualquiera de las clases ya generadas en este navegador.",
        deleteClassConfirm: "¿Está seguro de que desea eliminar esta clase de su historial?",
        slideCountText: "diapositivas",
        themeText: "Tema"
    }
};

function applyLanguage(lang) {
    localStorage.setItem("paradise_language", lang);
    document.cookie = `paradise_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    
    const t = classTranslations[lang] || classTranslations.pt;
    
    const backBtn = document.getElementById('back-to-panel-btn');
    if (backBtn) backBtn.innerHTML = t.backBtn;
    
    const panelTitle = document.querySelector('.panel-header h2');
    if (panelTitle) panelTitle.textContent = t.panelTitle;
    
    const panelDesc = document.querySelector('.panel-header p');
    if (panelDesc) panelDesc.textContent = t.panelDesc;
    
    const tabs = document.querySelectorAll('.type-tab');
    if (tabs.length >= 3) {
        tabs[0].innerHTML = t.tabTheme;
        tabs[1].innerHTML = t.tabText;
        tabs[2].innerHTML = t.tabPdf;
    }
    
    const btnGen = document.getElementById('btn-generate-classroom');
    if (btnGen) btnGen.innerHTML = t.btnGenerate;
    
    const themeInput = document.getElementById('theme-input');
    if (themeInput) themeInput.placeholder = t.themePlaceholder;
    
    const textInput = document.getElementById('text-input');
    if (textInput) textInput.placeholder = t.textPlaceholder;
    
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

    if (typeof updateAutoPlayUI === 'function') {
        updateAutoPlayUI();
    }

    if (typeof renderHistoryList === 'function') {
        renderHistoryList();
    }
}

document.getElementById('global-lang-select').addEventListener('change', (e) => {
    applyLanguage(e.target.value);
});

// Initialize Page Language
const currentLang = localStorage.getItem('paradise_language') || 'pt';
applyLanguage(currentLang);
renderHistoryList();

// Active Lesson Auto-Restore on Reload
const activeLessonData = localStorage.getItem('paradise_active_lesson');
if (activeLessonData) {
    try {
        const parsed = JSON.parse(activeLessonData);
        if (parsed && parsed.slides && parsed.slides.length > 0) {
            lessonData = parsed;
            const savedSlideIdx = parseInt(localStorage.getItem('paradise_active_lesson_slide') || '0', 10);
            currentSlideIdx = isNaN(savedSlideIdx) ? 0 : savedSlideIdx;
            setupPanel.style.display = 'none';
            stagePanel.style.display = 'flex';
            renderLesson();
        }
    } catch(e) {
        localStorage.removeItem('paradise_active_lesson');
        localStorage.removeItem('paradise_active_lesson_slide');
    }
}
