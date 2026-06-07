import { attachVoiceInput } from '../voice_input.js';

// Application state
const state = {
    currentType: 'theme',
    selectedPdfFile: null,
    isPlaying: false,
    currentSceneIdx: 0,
    narrativeData: null,
    audioLoading: false,
    wordRanges: [],
    animationFrameId: null,
    autoPlayEnabled: true,
    subtitlesVisible: true,
    currentSubtitleStyle: 'classic',
    outputFormat: 'youtube',   // 'youtube' | 'stories'
    // Audio preload cache: Map<segmentIndex, HTMLAudioElement>
    audioCache: new Map(),
    // Image preload cache: Map<segmentIndex, HTMLImageElement (fully loaded)>
    imageCache: new Map(),
    _composedThumbnailDataUrl: null
};

// DOM Cache
const dom = {
    setupPanel: document.getElementById('setup-panel'),
    loadingPanel: document.getElementById('loading-panel'),
    theaterArena: document.getElementById('theater-arena'),
    btnToggleSubtitles: document.getElementById('btn-toggle-subtitles'),
    subtitleStyleSelect: document.getElementById('subtitle-style-select'),
    subtitleOverlay: document.querySelector('.subtitle-overlay'),
    historyPanel: document.getElementById('history-panel'),
    historyList: document.getElementById('history-list'),
    historyTitleLabel: document.getElementById('history-title-label'),
    
    themeInput: document.getElementById('theme-input'),
    textInput: document.getElementById('text-input'),
    pdfFileInput: document.getElementById('pdf-file-input'),
    selectedFilename: document.getElementById('selected-filename'),
    pdfDropZone: document.getElementById('pdf-drop-zone'),
    
    genreSelect: document.getElementById('genre-select'),
    durationSelect: document.getElementById('duration-select'),
    voiceSelect: document.getElementById('voice-select'),
    
    btnGenerate: document.getElementById('btn-generate-narrative'),
    btnNewStory: document.getElementById('btn-new-story'),
    
    btnMicTheme: document.getElementById('btn-mic-theme'),
    btnMicText: document.getElementById('btn-mic-text'),
    
    storyTitle: document.getElementById('story-title'),
    storyBadge: document.getElementById('story-badge'),
    screenImage: document.getElementById('screen-image'),
    screenBackplate: document.getElementById('screen-backplate'),
    subtitleText: document.getElementById('subtitle-text'),
    ambientLayer: document.getElementById('ambient-layer'),
    
    btnPrev: document.getElementById('btn-prev'),
    btnPlay: document.getElementById('btn-play'),
    btnNext: document.getElementById('btn-next'),
    voiceWave: document.getElementById('voice-wave'),
    
    currentTime: document.getElementById('current-time'),
    totalTime: document.getElementById('total-time'),
    timelineSlider: document.getElementById('timeline-slider'),
    
    volumeSlider: document.getElementById('volume-slider'),
    volumeIcon: document.getElementById('volume-icon'),
    speedSelect: document.getElementById('speed-select'),
    sceneCounter: document.getElementById('scene-counter'),
    scenesList: document.getElementById('scenes-list'),
    
    audioEl: document.getElementById('narrative-audio'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    
    loadingStepTitle: document.getElementById('loading-step-title'),
    loadingStepDesc: document.getElementById('loading-step-desc'),
    
    thumbnailImg: document.getElementById('thumbnail-img'),
    thumbnailPlaceholder: document.getElementById('thumbnail-placeholder'),
    btnDownloadThumbnail: document.getElementById('btn-download-thumbnail'),
    btnChangeThumbnail: document.getElementById('btn-change-thumbnail'),
    horrorEffectSelect: document.getElementById('horror-effect-select'),
    horrorOverlay: document.getElementById('horror-overlay'),
    imageAnimationSelect: document.getElementById('image-animation-select'),
    formatBtnYoutube: document.getElementById('format-btn-youtube'),
    formatBtnStories: document.getElementById('format-btn-stories'),
    generateBtnLabel: document.getElementById('generate-btn-label')
};

// Translations
const translations = {
    pt: {
        stepRoteiro: "Escrevendo roteiro da história...",
        stepRoteiroDesc: "A inteligência do Gemini está estruturando os parágrafos e gerando ilustrações cinematográficas sob medida.",
        stepImagens: "Ilustrando cenas...",
        stepImagensDesc: "Gera ilustrações ricas com IA correspondendo perfeitamente ao gênero selecionado.",
        audioPreparando: "Preparando a voz da narração para esta cena...",
        audioErro: "(Áudio indisponível)",
        pdfAlert: "Apenas arquivos PDF são aceitos!",
        newStoryBtn: "<i class='fa-solid fa-arrow-rotate-left'></i> Nova História",
        generateBtn: "<i class='fa-solid fa-wand-magic-sparkles'></i> Gerar Vídeo Narrativa",
        themePlaceholder: "Ex: Um navio fantasma perdido em uma tempestade eterna no Triângulo das Bermudas",
        textPlaceholder: "Cole o texto original aqui. A IA irá reescrever, segmentar e ilustrar a história completa...",
        loadingContent: "Carregando narração...",
        subStyleClassic: "🟡 Amarelo Clássico",
        subStyleNeon: "⚡ Brilho Neon",
        subStyleMinimalist: "⚪ Minimalista",
        subStyleKaraoke: "🎤 Karaokê",
        historyTitle: "Histórico de Narrativas",
        deleteNarrativeConfirm: "Tem certeza que deseja excluir esta história do seu histórico?",
        emptyHistory: "Nenhuma narrativa produzida ainda. Crie uma nova história para começar!",
        scenesText: "cenas",
        minutesText: "minutos"
    },
    en: {
        stepRoteiro: "Writing story script...",
        stepRoteiroDesc: "Gemini intelligence is structuring paragraphs and creating tailored cinematic illustrations.",
        stepImagens: "Illustrating scenes...",
        stepImagensDesc: "Generating rich AI illustrations perfectly matching the selected genre.",
        audioPreparando: "Preparing narrator voice for this scene...",
        audioErro: "(Audio unavailable)",
        pdfAlert: "Only PDF files are accepted!",
        newStoryBtn: "<i class='fa-solid fa-arrow-rotate-left'></i> New Story",
        generateBtn: "<i class='fa-solid fa-wand-magic-sparkles'></i> Generate Video Narrative",
        themePlaceholder: "E.g. A ghost ship lost in an eternal storm in the Bermuda Triangle",
        textPlaceholder: "Paste original text here. AI will rewrite, segment, and illustrate the complete story...",
        loadingContent: "Loading narration...",
        subStyleClassic: "🟡 Classic Yellow",
        subStyleNeon: "⚡ Neon Glow",
        subStyleMinimalist: "⚪ Minimalist",
        subStyleKaraoke: "🎤 Karaoke",
        historyTitle: "Narrative History",
        deleteNarrativeConfirm: "Are you sure you want to delete this story from your history?",
        emptyHistory: "No narratives produced yet. Create a new story to start!",
        scenesText: "scenes",
        minutesText: "minutes"
    },
    es: {
        stepRoteiro: "Escribiendo guión de la historia...",
        stepRoteiroDesc: "La inteligencia de Gemini está estruturando los párrafos y creando ilustraciones cinematográficas a medida.",
        stepImagens: "Ilustrando cenas...",
        stepImagensDesc: "Generando ricas ilustraciones con IA correspondientes al género seleccionado.",
        audioPreparando: "Preparando la voz del narrador para esta escena...",
        audioErro: "(Audio no disponible)",
        pdfAlert: "¡Solo se aceptan archivos PDF!",
        newStoryBtn: "<i class='fa-solid fa-arrow-rotate-left'></i> Nueva Historia",
        generateBtn: "<i class='fa-solid fa-wand-magic-sparkles'></i> Generar Video Narrativa",
        themePlaceholder: "Ej: Un barco fantasma perdido en una tormenta eterna en el Triángulo de las Bermudas",
        textPlaceholder: "Pegue el texto original aquí. La IA reescribirá, segmentará e ilustrará la historia completa...",
        loadingContent: "Cargando narración...",
        subStyleClassic: "🟡 Amarillo Clásico",
        subStyleNeon: "⚡ Brillo Neon",
        subStyleMinimalist: "⚪ Minimalista",
        subStyleKaraoke: "🎤 Karaoke",
        historyTitle: "Historial de Narrativas",
        deleteNarrativeConfirm: "¿Está seguro de que desea eliminar esta historia de su historial?",
        emptyHistory: "¡Ninguna narrativa producida todavía. Cree una historia para comenzar!",
        scenesText: "escenas",
        minutesText: "minutos"
    }
};

function getActiveLanguage() {
    return localStorage.getItem('paradise_language') || 'pt';
}

function getT() {
    return translations[getActiveLanguage()] || translations.pt;
}

// Form validation check
function checkInputs() {
    let valid = false;
    if (state.currentType === 'theme' && dom.themeInput.value.trim() !== '') {
        valid = true;
    } else if (state.currentType === 'text' && dom.textInput.value.trim() !== '') {
        valid = true;
    } else if (state.currentType === 'pdf' && state.selectedPdfFile !== null) {
        valid = true;
    }
    dom.btnGenerate.disabled = !valid;
}

// PDF File select handler
function handlePdfFile(file) {
    const t = getT();
    if (file.type !== 'application/pdf') {
        alert(t.pdfAlert);
        return;
    }
    state.selectedPdfFile = file;
    dom.selectedFilename.textContent = `PDF: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    dom.selectedFilename.style.display = 'block';
    checkInputs();
}

// Load and render story playlist
function renderPlaylist() {
    dom.scenesList.innerHTML = '';
    const segments = state.narrativeData.segments || [];
    segments.forEach((seg, idx) => {
        const card = document.createElement('div');
        card.className = `scene-card ${idx === state.currentSceneIdx ? 'active' : ''}`;
        
        let thumbUrl = seg.image_url || '';
        if (thumbUrl && (thumbUrl.includes("googleusercontent.com") || thumbUrl.includes("google.com"))) {
            thumbUrl = `/api/proxy-image?url=${encodeURIComponent(thumbUrl)}`;
        }
        
        card.innerHTML = `
            <div class="scene-thumb">
                <img src="${thumbUrl || '/static/images/walle.png'}" alt="Scene Thumbnail">
            </div>
            <div class="scene-info">
                <div class="scene-title">Cena ${idx + 1}</div>
                <div class="scene-preview">${seg.text}</div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            if (state.audioLoading) return;
            loadScene(idx);
        });
        dom.scenesList.appendChild(card);
    });
}

// Apply Ambient Particle Effects depending on genre
function applyAmbientEffects(genre) {
    if (!dom.ambientLayer) return;
    dom.ambientLayer.className = `ambient-layer ${genre}`;
    dom.ambientLayer.innerHTML = '';
    
    // Staggered dots count
    let count = 0;
    let className = '';
    
    if (genre === 'terror') {
        count = 15;
        className = 'red-ember';
    } else if (genre === 'infantil') {
        count = 12;
        className = 'pastel-bubble';
    } else if (genre === 'fantasia') {
        count = 18;
        className = 'sparkle-light';
    } else if (genre === 'scifi') {
        count = 15;
        className = 'digital-pixel';
    } else if (genre === 'suspense') {
        count = 10;
        className = 'misty-smoke';
    }
    
    for (let i = 0; i < count; i++) {
        const p = document.createElement('span');
        p.className = `particle ${className}`;
        p.style.left = `${Math.random() * 100}%`;
        p.style.top = `${Math.random() * 100}%`;
        p.style.animationDelay = `${Math.random() * 4}s`;
        p.style.animationDuration = `${Math.random() * 5 + 3}s`;
        dom.ambientLayer.appendChild(p);
    }
}

// ─── Audio Preload Cache ─────────────────────────────────────────────────────

/**
 * Silently fetches and caches the TTS audio for a given segment index.
 * Returns immediately if the segment is already cached or out of range.
 */
function preloadAudioForScene(idx) {
    if (!state.narrativeData?.segments) return;
    const segments = state.narrativeData.segments;
    if (idx < 0 || idx >= segments.length) return;
    if (state.audioCache.has(idx)) return;  // already cached

    const segment = segments[idx];
    const voice = dom.voiceSelect.value;
    const url = `/api/narrative/tts?text=${encodeURIComponent(segment.text)}&voice=${encodeURIComponent(voice)}`;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audio.load();
    state.audioCache.set(idx, audio);
}

/**
 * Preloads the next N scenes' audio in the background.
 * Called after each scene loads so the next transition is instantaneous.
 */
function preloadAdjacentScenes(currentIdx, ahead = 2) {
    for (let i = 1; i <= ahead; i++) {
        preloadAudioForScene(currentIdx + i);
    }
}

/**
 * Clears the audio cache (e.g. when starting a new story or changing voice).
 */
function clearAudioCache() {
    state.audioCache.forEach(audio => {
        audio.pause();
        audio.src = '';
    });
    state.audioCache.clear();
}

// ─── Image Preload Cache ─────────────────────────────────────────────────────

/**
 * Resolves the proxy URL for a scene image (Google/Gemini images need proxying).
 */
function resolveImageUrl(rawUrl) {
    if (!rawUrl) return null;
    if (rawUrl.includes('googleusercontent.com') || rawUrl.includes('google.com')) {
        return `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
}

/**
 * Silently preloads the image for a given segment index into the cache.
 * Returns immediately if already cached or out of range.
 */
function preloadImageForScene(idx) {
    if (!state.narrativeData?.segments) return;
    const segments = state.narrativeData.segments;
    if (idx < 0 || idx >= segments.length) return;
    if (state.imageCache.has(idx)) return;   // already cached

    const rawUrl = segments[idx].image_url;
    const proxyUrl = resolveImageUrl(rawUrl);
    if (!proxyUrl) return;

    const img = new Image();
    img.src = proxyUrl;
    // Store even before onload so we don't double-fetch
    state.imageCache.set(idx, { img, proxyUrl, ready: false });
    img.onload = () => {
        const entry = state.imageCache.get(idx);
        if (entry) entry.ready = true;
    };
}

/**
 * Preloads the next N scenes' images in the background.
 */
function preloadAdjacentImages(currentIdx, ahead = 2) {
    for (let i = 1; i <= ahead; i++) {
        preloadImageForScene(currentIdx + i);
    }
}

/**
 * Clears the image cache (e.g. when starting a new story).
 */
function clearImageCache() {
    state.imageCache.clear();
}

// ─────────────────────────────────────────────────────────────────────────────

// Load individual scene
async function loadScene(idx) {
    if (!state.narrativeData || !state.narrativeData.segments || idx < 0 || idx >= state.narrativeData.segments.length) return;
    
    // Apply current horror effect on scene change (handles auto, random, and specific effects)
    if (dom.horrorEffectSelect) {
        applyHorrorEffect(dom.horrorEffectSelect.value);
    }
    
    state.currentSceneIdx = idx;
    const segment = state.narrativeData.segments[idx];
    const t = getT();
    
    // Highlight sidebar active card
    const cards = dom.scenesList.querySelectorAll('.scene-card');
    cards.forEach((c, cIdx) => {
        if (cIdx === idx) c.classList.add('active');
        else c.classList.remove('active');
    });
    
    // Update navigation states
    dom.btnPrev.disabled = idx === 0;
    dom.btnNext.disabled = idx === state.narrativeData.segments.length - 1;
    dom.sceneCounter.textContent = `Cena ${idx + 1} / ${state.narrativeData.segments.length}`;
    
    // Update scene image — use preloaded cache for instant display
    dom.screenImage.classList.remove('reveal');
    if (segment.image_url) {
        const proxyUrl = resolveImageUrl(segment.image_url);
        const cached = state.imageCache.get(idx);

        if (cached?.ready) {
            // ✅ Cache hit — image already decoded by browser, reveal instantly
            dom.screenImage.onload = null;
            dom.screenImage.src = cached.proxyUrl;
            dom.screenBackplate.style.backgroundImage = `url('${cached.proxyUrl}')`;
            // Use requestAnimationFrame to ensure paint before adding class
            requestAnimationFrame(() => {
                dom.screenImage.classList.add('reveal');
                if (dom.imageAnimationSelect) applyImageAnimation(dom.imageAnimationSelect.value);
            });
        } else {
            // Cache miss — set src and wait for load (browser may benefit from
            // the in-flight proxy cache hit on the server side)
            dom.screenImage.onload = () => {
                dom.screenImage.classList.add('reveal');
                if (dom.imageAnimationSelect) applyImageAnimation(dom.imageAnimationSelect.value);

                // Mark as ready in cache once loaded
                const entry = state.imageCache.get(idx);
                if (entry) entry.ready = true;
            };
            dom.screenImage.src = proxyUrl;
            dom.screenBackplate.style.backgroundImage = `url('${proxyUrl}')`;
            if (!state.imageCache.has(idx)) preloadImageForScene(idx);
        }
    } else {
        dom.screenImage.onload = null;
        dom.screenImage.src = '';
        dom.screenBackplate.style.backgroundImage = 'none';
    }

    // Preload next scenes' images in background
    preloadAdjacentImages(idx);

    
    // Prepare Subtitle timing ranges
    const words = segment.text.split(' ');
    let totalChars = words.reduce((acc, w) => acc + w.length, 0);
    let currentSum = 0;
    state.wordRanges = words.map(w => {
        let start = currentSum / totalChars;
        currentSum += w.length;
        let end = currentSum / totalChars;
        return { start, end };
    });
    
    dom.subtitleText.innerHTML = words.map((w, wIdx) => `<span class="sub-word" id="word-${wIdx}">${w}</span>`).join(' ');
    
    // Stop previous player states
    dom.audioEl.pause();
    dom.audioEl.src = '';
    state.isPlaying = false;
    dom.btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
    dom.voiceWave.classList.remove('active');
    stopSubtitleLoop();
    
    dom.timelineSlider.value = 0;
    dom.currentTime.textContent = '00:00';
    dom.totalTime.textContent = '00:00';
    
    // ── Audio: use preloaded cache if available, otherwise fetch now ──────────
    state.audioLoading = true;
    dom.btnPlay.disabled = true;
    dom.subtitleText.innerHTML = `<span style="color: var(--text-secondary); font-style: italic;">${t.audioPreparando}</span>`;

    // Preload next scenes silently in background
    preloadAdjacentScenes(idx);

    try {
        const voice = dom.voiceSelect.value;

        const activateAudio = (audioEl) => {
            // Swap the preloaded Audio element into the main player
            dom.audioEl.oncanplaythrough = null;
            dom.audioEl.onerror = null;
            dom.audioEl.pause();
            dom.audioEl.src = audioEl.src;
            dom.audioEl.load();

            const handleCanPlay = () => {
                dom.audioEl.oncanplaythrough = null;
                dom.audioEl.onerror = null;
                state.audioLoading = false;
                dom.btnPlay.disabled = false;

                dom.subtitleText.innerHTML = words.map((w, wIdx) =>
                    `<span class="sub-word" id="word-${wIdx}">${w}</span>`).join(' ');

                dom.audioEl.playbackRate = parseFloat(dom.speedSelect.value);

                dom.audioEl.play().then(() => {
                    dom.btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    dom.voiceWave.classList.add('active');
                    state.isPlaying = true;
                    startSubtitleLoop();
                }).catch(err => {
                    console.warn('Autoplay blocked:', err);
                    dom.btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
                    dom.voiceWave.classList.remove('active');
                    state.isPlaying = false;
                });
            };

            const handleAudioError = (err) => {
                console.error('Audio playback error:', err);
                dom.audioEl.oncanplaythrough = null;
                dom.audioEl.onerror = null;
                state.audioLoading = false;
                dom.btnPlay.disabled = false;
                dom.subtitleText.innerHTML = words.map((w, wIdx) =>
                    `<span class="sub-word" id="word-${wIdx}">${w}</span>`).join(' ') +
                    ` <span style="color:#ef4444;font-size:0.85em;display:block;margin-top:0.25rem;">${t.audioErro}</span>`;
            };

            dom.audioEl.oncanplaythrough = handleCanPlay;
            dom.audioEl.onerror = handleAudioError;
            if (dom.audioEl.readyState >= 4) handleCanPlay();
        };

        if (state.audioCache.has(idx)) {
            // ✅ Cache hit — instant playback
            const cached = state.audioCache.get(idx);
            activateAudio(cached);
        } else {
            // Cache miss — fetch now and cache
            const url = `/api/narrative/tts?text=${encodeURIComponent(segment.text)}&voice=${encodeURIComponent(voice)}`;
            const fresh = new Audio();
            fresh.preload = 'auto';
            fresh.src = url;
            fresh.load();
            state.audioCache.set(idx, fresh);
            activateAudio(fresh);
        }
    } catch (e) {
        console.error('Audio generation loading error:', e);
        dom.subtitleText.textContent = segment.text + ` ${t.audioErro}`;
        state.audioLoading = false;
    }
}

// Subtitles character range matching
function updateSubtitlesHighlight() {
    if (!dom.audioEl.duration) return;
    const current = dom.audioEl.currentTime;
    const duration = dom.audioEl.duration;
    const ratio = current / duration;
    
    let activeIdx = -1;
    for (let i = 0; i < state.wordRanges.length; i++) {
        if (ratio >= state.wordRanges[i].start && ratio < state.wordRanges[i].end) {
            activeIdx = i;
            break;
        }
    }
    if (activeIdx === -1 && ratio >= 0.99) {
        activeIdx = state.wordRanges.length - 1;
    }
    
    const spans = dom.subtitleText.querySelectorAll('.sub-word');
    spans.forEach((span, idx) => {
        if (idx === activeIdx) {
            span.classList.add('highlighted');
        } else {
            span.classList.remove('highlighted');
        }
    });
}

function startSubtitleLoop() {
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    function loop() {
        updateSubtitlesHighlight();
        if (state.isPlaying) {
            state.animationFrameId = requestAnimationFrame(loop);
        }
    }
    state.animationFrameId = requestAnimationFrame(loop);
}

function stopSubtitleLoop() {
    if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
    }
}

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

// Bind controls and configurations
function setupEvents() {
    dom.themeInput.addEventListener('input', checkInputs);
    dom.textInput.addEventListener('input', checkInputs);
    
    // Tab selectors
    const tabs = document.querySelectorAll('.type-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentType = tab.getAttribute('data-type');
            
            document.getElementById('group-theme').style.display = state.currentType === 'theme' ? 'flex' : 'none';
            document.getElementById('group-text').style.display = state.currentType === 'text' ? 'flex' : 'none';
            document.getElementById('group-pdf').style.display = state.currentType === 'pdf' ? 'flex' : 'none';
            
            checkInputs();
        });
    });
    
    // Drag & Drop PDF
    dom.pdfDropZone.addEventListener('click', () => dom.pdfFileInput.click());
    dom.pdfFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlePdfFile(e.target.files[0]);
        }
    });
    
    dom.pdfDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.pdfDropZone.style.borderColor = 'rgba(139, 92, 246, 0.7)';
    });
    
    dom.pdfDropZone.addEventListener('dragleave', () => {
        dom.pdfDropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    });
    
    dom.pdfDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.pdfDropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        if (e.dataTransfer.files.length > 0) {
            handlePdfFile(e.dataTransfer.files[0]);
        }
    });
    
    // Generate trigger
    dom.btnGenerate.addEventListener('click', async () => {
        const t = getT();
        dom.setupPanel.style.display = 'none';
        dom.loadingPanel.style.display = 'flex';
        
        dom.loadingStepTitle.textContent = t.stepRoteiro;
        dom.loadingStepDesc.textContent = t.stepRoteiroDesc;
        
        const formData = new FormData();
        formData.append('type', state.currentType);
        formData.append('genre', dom.genreSelect.value);
        formData.append('duration', dom.durationSelect.value);
        formData.append('voice', dom.voiceSelect.value);
        formData.append('language', getActiveLanguage());
        formData.append('format', state.outputFormat);
        
        if (state.currentType === 'theme') {
            formData.append('content', dom.themeInput.value.trim());
        } else if (state.currentType === 'text') {
            formData.append('content', dom.textInput.value.trim());
        } else if (state.currentType === 'pdf') {
            formData.append('file', state.selectedPdfFile);
        }
        
        // Dynamic loader steps
        const stepInterval = setTimeout(() => {
            if (dom.loadingPanel.style.display === 'flex') {
                dom.loadingStepTitle.textContent = t.stepImagens;
                dom.loadingStepDesc.textContent = t.stepImagensDesc;
            }
        }, 9000);
        
        try {
            const resp = await fetch('/api/narrative/generate', {
                method: 'POST',
                body: formData
            });
            
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            
            state.narrativeData = await resp.json();
            
            clearTimeout(stepInterval);
            dom.loadingPanel.style.display = 'none';
            dom.theaterArena.style.display = 'flex';

            // Apply output format mode
            if (state.outputFormat === 'stories') {
                dom.theaterArena.classList.add('stories-mode');
            } else {
                dom.theaterArena.classList.remove('stories-mode');
            }
            
            // Populate titles
            dom.storyTitle.textContent = state.narrativeData.title || "Narrativa";
            dom.storyBadge.textContent = dom.genreSelect.options[dom.genreSelect.selectedIndex].text.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
            
            applyAmbientEffects(dom.genreSelect.value);
            // Apply selected or automatic genre-based effects/animations
            if (dom.horrorEffectSelect) {
                applyHorrorEffect(dom.horrorEffectSelect.value);
            }
            if (dom.imageAnimationSelect) {
                applyImageAnimation(dom.imageAnimationSelect.value);
            }
            renderPlaylist();
            clearAudioCache();   // discard any cached audio from previous story
            clearImageCache();   // discard any cached images from previous story
            loadScene(0);
            updateThumbnailUI();
            saveNarrativeToHistory(state.narrativeData);
        } catch (e) {
            clearTimeout(stepInterval);
            alert(`Falha ao gerar narrativa: ${e.message || e}`);
            dom.loadingPanel.style.display = 'none';
            dom.setupPanel.style.display = 'flex';
        }
    });
    
    // Play/Pause Action
    dom.btnPlay.addEventListener('click', () => {
        if (state.audioLoading) return;
        
        if (dom.audioEl.paused) {
            dom.audioEl.play();
            dom.btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            dom.voiceWave.classList.add('active');
            state.isPlaying = true;
            startSubtitleLoop();
        } else {
            dom.audioEl.pause();
            dom.btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            dom.voiceWave.classList.remove('active');
            state.isPlaying = false;
            stopSubtitleLoop();
        }
    });
    
    // Navigation
    dom.btnPrev.addEventListener('click', () => {
        if (state.currentSceneIdx > 0) {
            loadScene(state.currentSceneIdx - 1);
        }
    });
    
    dom.btnNext.addEventListener('click', () => {
        if (state.currentSceneIdx < state.narrativeData.segments.length - 1) {
            loadScene(state.currentSceneIdx + 1);
        }
    });
    
    // Timeline Seek
    dom.timelineSlider.addEventListener('input', () => {
        if (dom.audioEl.duration) {
            const pct = dom.timelineSlider.value;
            dom.audioEl.currentTime = (pct / 100) * dom.audioEl.duration;
        }
    });
    
    dom.audioEl.addEventListener('timeupdate', () => {
        if (dom.audioEl.duration) {
            const current = dom.audioEl.currentTime;
            const duration = dom.audioEl.duration;
            const pct = (current / duration) * 100;
            
            dom.timelineSlider.value = pct;
            dom.currentTime.textContent = formatTime(current);
            dom.totalTime.textContent = formatTime(duration);
        }
    });
    
    dom.audioEl.addEventListener('ended', () => {
        dom.btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        dom.voiceWave.classList.remove('active');
        state.isPlaying = false;
        stopSubtitleLoop();
        
        // Auto transition to next segment scene
        if (state.autoPlayEnabled && state.currentSceneIdx < state.narrativeData.segments.length - 1) {
            const endedScene = state.currentSceneIdx;
            setTimeout(() => {
                if (state.currentSceneIdx === endedScene) {
                    loadScene(state.currentSceneIdx + 1);
                }
            }, 200);
        }
    });
    
    // Volume Control
    dom.volumeSlider.addEventListener('input', () => {
        const volVal = dom.volumeSlider.value;
        const vol = volVal / 100;
        dom.audioEl.volume = vol;
        if (vol === 0) {
            dom.volumeIcon.className = "fa-solid fa-volume-xmark";
        } else if (vol < 0.5) {
            dom.volumeIcon.className = "fa-solid fa-volume-low";
        } else {
            dom.volumeIcon.className = "fa-solid fa-volume-high";
        }
        localStorage.setItem('narrative_volume', volVal);
    });
    
    // Playback Speed Rate
    dom.speedSelect.addEventListener('change', () => {
        const speedVal = dom.speedSelect.value;
        dom.audioEl.playbackRate = parseFloat(speedVal);
        localStorage.setItem('narrative_speed', speedVal);
    });
    
    dom.btnNewStory.addEventListener('click', () => {
        dom.audioEl.pause();
        dom.audioEl.src = '';
        state.isPlaying = false;
        stopSubtitleLoop();
        
        dom.theaterArena.style.display = 'none';
        dom.theaterArena.classList.remove('stories-mode');   // reset format on new story
        dom.setupPanel.style.display = 'flex';
        
        dom.themeInput.value = '';
        dom.textInput.value = '';
        state.selectedPdfFile = null;
        dom.pdfFileInput.value = '';
        dom.selectedFilename.style.display = 'none';
        dom.btnGenerate.disabled = true;
        resetThumbnailUI();
    });
    
    // Subtitle Toggle Click
    if (dom.btnToggleSubtitles) {
        dom.btnToggleSubtitles.addEventListener('click', () => {
            state.subtitlesVisible = !state.subtitlesVisible;
            localStorage.setItem('narrative_subtitles_visible', state.subtitlesVisible);
            if (state.subtitlesVisible) {
                dom.subtitleOverlay.style.display = 'block';
                dom.btnToggleSubtitles.style.opacity = '1';
                dom.btnToggleSubtitles.style.color = 'var(--accent-pink)';
            } else {
                dom.subtitleOverlay.style.display = 'none';
                dom.btnToggleSubtitles.style.opacity = '0.5';
                dom.btnToggleSubtitles.style.color = 'var(--text-secondary)';
            }
        });
    }

    // Subtitle Style Change
    if (dom.subtitleStyleSelect) {
        dom.subtitleStyleSelect.addEventListener('change', () => {
            const style = dom.subtitleStyleSelect.value;
            dom.subtitleOverlay.classList.remove('sub-style-classic', 'sub-style-neon', 'sub-style-minimalist', 'sub-style-karaoke');
            dom.subtitleOverlay.classList.add(`sub-style-${style}`);
            state.currentSubtitleStyle = style;
            localStorage.setItem('narrative_subtitle_style', style);
        });
    }

    // Mic dictation binding
    if (dom.btnMicTheme && dom.themeInput) {
        attachVoiceInput(dom.themeInput, dom.btnMicTheme, getActiveLanguage);
        dom.themeInput.addEventListener('change', checkInputs);
    }
    if (dom.btnMicText && dom.textInput) {
        attachVoiceInput(dom.textInput, dom.btnMicText, getActiveLanguage);
        dom.textInput.addEventListener('change', checkInputs);
    }

    // Fullscreen Event Binding
    if (dom.btnFullscreen) {
        let hideControlsTimeout;
        const controls = document.querySelector('.media-controls');

        function hideControls() {
            if (controls) {
                controls.style.opacity = '0';
                controls.style.pointerEvents = 'none';
            }
            document.body.style.cursor = 'none';
        }

        function showControls() {
            if (controls) {
                controls.style.opacity = '1';
                controls.style.pointerEvents = 'auto';
            }
            document.body.style.cursor = 'default';
            clearTimeout(hideControlsTimeout);
            if (document.fullscreenElement) {
                hideControlsTimeout = setTimeout(hideControls, 3000);
            }
        }

        dom.btnFullscreen.addEventListener('click', () => {
            const container = document.querySelector('.theater-screen');
            if (!container) return;
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(err => {
                    console.error("Error enabling fullscreen:", err);
                });
                dom.btnFullscreen.innerHTML = '<i class="fa-solid fa-compress"></i>';
            } else {
                document.exitFullscreen();
                dom.btnFullscreen.innerHTML = '<i class="fa-solid fa-expand"></i>';
            }
        });

        document.addEventListener('fullscreenchange', () => {
            const container = document.querySelector('.theater-screen');
            if (document.fullscreenElement === container) {
                dom.btnFullscreen.innerHTML = '<i class="fa-solid fa-compress"></i>';
                container.addEventListener('mousemove', showControls);
                // Hide controls immediately on entry — show only on mouse movement
                hideControls();
            } else {
                dom.btnFullscreen.innerHTML = '<i class="fa-solid fa-expand"></i>';
                if (container) container.removeEventListener('mousemove', showControls);
                clearTimeout(hideControlsTimeout);
                if (controls) {
                    controls.style.opacity = '1';
                    controls.style.pointerEvents = 'auto';
                }
                document.body.style.cursor = 'default';
            }
        });
    }

    // ─── Keyboard Controls ───────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        // Only active when the theater is visible; ignore if typing in an input
        if (dom.theaterArena.style.display === 'none') return;
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                if (dom.btnPlay) dom.btnPlay.click();
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (dom.btnNext && !dom.btnNext.disabled) dom.btnNext.click();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (dom.btnPrev && !dom.btnPrev.disabled) dom.btnPrev.click();
                break;
            case 'KeyF':
                e.preventDefault();
                if (dom.btnFullscreen) dom.btnFullscreen.click();
                break;
            case 'Escape':
                if (document.fullscreenElement) document.exitFullscreen();
                break;
        }
    });

    // Voice select change → clear audio cache so re-generated TTS uses new voice
    if (dom.voiceSelect) {
        dom.voiceSelect.addEventListener('change', () => {
            clearAudioCache();
        });
    }

    // ─── Format Selector (YouTube / Stories) ────────────────────────────────
    [dom.formatBtnYoutube, dom.formatBtnStories].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', () => {
            dom.formatBtnYoutube?.classList.remove('active');
            dom.formatBtnStories?.classList.remove('active');
            btn.classList.add('active');
            state.outputFormat = btn.dataset.format;

            // Update generate button label
            if (dom.generateBtnLabel) {
                const lang = localStorage.getItem('paradise_language') || 'pt';
                if (state.outputFormat === 'stories') {
                    dom.generateBtnLabel.textContent =
                        lang === 'en' ? 'Generate Stories' :
                        lang === 'es' ? 'Generar Stories' :
                                        'Gerar Stories';
                } else {
                    dom.generateBtnLabel.textContent =
                        lang === 'en' ? 'Generate Narrative Video' :
                        lang === 'es' ? 'Generar Video Narrativa' :
                                        'Gerar Vídeo Narrativa';
                }
            }
        });
    });

    // Horror Effect Selector Change
    if (dom.horrorEffectSelect) {
        dom.horrorEffectSelect.addEventListener('change', () => {
            const val = dom.horrorEffectSelect.value;
            applyHorrorEffect(val);
            localStorage.setItem('narrative_horror_effect', val);
        });
    }

    // Image Animation Selector Change
    if (dom.imageAnimationSelect) {
        dom.imageAnimationSelect.addEventListener('change', () => {
            const val = dom.imageAnimationSelect.value;
            applyImageAnimation(val);
            localStorage.setItem('narrative_image_animation', val);
        });
    }
}// Global Language selectors updates
function applyLanguageUpdates(lang) {
    localStorage.setItem('paradise_language', lang);
    document.cookie = `paradise_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    
    const t = translations[lang] || translations.pt;
    
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) backBtn.innerHTML = lang === 'en' ? '<i class="fa-solid fa-arrow-left"></i> General Panel' : 
                                     lang === 'es' ? '<i class="fa-solid fa-arrow-left"></i> Panel General' : 
                                                     '<i class="fa-solid fa-arrow-left"></i> Painel Geral';
                                                     
    const headerTitle = document.querySelector('.panel-header h2');
    if (headerTitle) headerTitle.textContent = lang === 'en' ? 'Narrator AI (Narrative AI)' : 
                                               lang === 'es' ? 'Narrador AI (Narrativa AI)' : 
                                                               'Narrativa AI (Narrator AI)';
                                                               
    const headerDesc = document.querySelector('.panel-header p');
    if (headerDesc) headerDesc.textContent = lang === 'en' ? 'Create fascinating stories with professional dubbing and synchronized custom images.' : 
                                             lang === 'es' ? 'Genera historias fascinantes con doblaje profesional e imágenes sincronizadas a medida.' : 
                                                             'Gere histórias fascinantes com dublagem profissional e imagens sincronizadas sob medida.';
                                                             
    const tabs = document.querySelectorAll('.type-tab');
    if (tabs.length >= 3) {
        tabs[0].innerHTML = lang === 'en' ? '<i class="fa-solid fa-lightbulb"></i> Theme/Idea' : 
                            lang === 'es' ? '<i class="fa-solid fa-lightbulb"></i> Tema/Idea' : 
                                            '<i class="fa-solid fa-lightbulb"></i> Tema/Ideia';
        tabs[1].innerHTML = lang === 'en' ? '<i class="fa-solid fa-align-left"></i> Full Text' : 
                            lang === 'es' ? '<i class="fa-solid fa-align-left"></i> Texto Completo' : 
                                            '<i class="fa-solid fa-align-left"></i> Texto Completo';
        tabs[2].innerHTML = lang === 'en' ? '<i class="fa-solid fa-file-pdf"></i> Upload PDF' : 
                            lang === 'es' ? '<i class="fa-solid fa-file-pdf"></i> Subir PDF' : 
                                            '<i class="fa-solid fa-file-pdf"></i> Enviar PDF';
    }
    
    const labelTheme = document.querySelector('label[for="theme-input"]');
    if (labelTheme) labelTheme.textContent = lang === 'en' ? 'What is the main idea or theme of your story?' : 
                                             lang === 'es' ? '¿Cuál es la idea principal o tema de tu historia?' : 
                                                             'Qual é a ideia principal ou tema da sua história?';
                                                             
    const labelText = document.querySelector('label[for="text-input"]');
    if (labelText) labelText.textContent = lang === 'en' ? 'Paste or type your story text' : 
                                            lang === 'es' ? 'Pegue o escriba el texto de su historia' : 
                                                            'Cole ou digite o texto da sua história';
                                                            
    const labelPdf = document.querySelector('#group-pdf label');
    if (labelPdf) labelPdf.textContent = lang === 'en' ? 'Select a PDF file to serve as script' : 
                                         lang === 'es' ? 'Seleccione un archivo PDF para servir de guión' : 
                                                         'Selecione um arquivo PDF para servir de roteiro';
                                                         
    const dropZoneText = document.querySelector('.file-drop-zone p');
    if (dropZoneText) dropZoneText.innerHTML = lang === 'en' ? 'Drag your PDF here or <span style="color:#a78bfa; text-decoration: underline;">click to choose</span>' : 
                                               lang === 'es' ? 'Arrastre su PDF aquí o <span style="color:#a78bfa; text-decoration: underline;">haga clic para elegir</span>' : 
                                                               'Arraste seu PDF aqui ou <span style="color:#a78bfa; text-decoration: underline;">clique para escolher</span>';
                                                               
    const labelGenre = document.querySelector('label[for="genre-select"]');
    if (labelGenre) labelGenre.innerHTML = lang === 'en' ? '<i class="fa-solid fa-masks-theater"></i> Story Style/Genre' : 
                                           lang === 'es' ? '<i class="fa-solid fa-masks-theater"></i> Estilo/Género de la Historia' : 
                                                           '<i class="fa-solid fa-masks-theater"></i> Estilo/Gênero da História';
                                                           
    const labelDur = document.querySelector('label[for="duration-select"]');
    if (labelDur) labelDur.innerHTML = lang === 'en' ? '<i class="fa-solid fa-clock"></i> Estimated Duration' : 
                                       lang === 'es' ? '<i class="fa-solid fa-clock"></i> Duración Estimada' : 
                                                       '<i class="fa-solid fa-clock"></i> Duração Estimada';
                                                       
    const labelVoice = document.querySelector('label[for="voice-select"]');
    if (labelVoice) labelVoice.innerHTML = lang === 'en' ? '<i class="fa-solid fa-circle-user"></i> Narrator Voice' : 
                                           lang === 'es' ? '<i class="fa-solid fa-circle-user"></i> Voz del Narrador' : 
                                                           '<i class="fa-solid fa-circle-user"></i> Voz do Narrador';
                                                           
    dom.btnGenerate.innerHTML = t.generateBtn;
    dom.btnNewStory.innerHTML = t.newStoryBtn;
    dom.themeInput.placeholder = t.themePlaceholder;
    dom.textInput.placeholder = t.textPlaceholder;
    
    const subClassicOpt = document.querySelector('#subtitle-style-select option[value="classic"]');
    const subNeonOpt = document.querySelector('#subtitle-style-select option[value="neon"]');
    const subMinOpt = document.querySelector('#subtitle-style-select option[value="minimalist"]');
    const subKaraokeOpt = document.querySelector('#subtitle-style-select option[value="karaoke"]');

    if (subClassicOpt) subClassicOpt.textContent = t.subStyleClassic;
    if (subNeonOpt) subNeonOpt.textContent = t.subStyleNeon;
    if (subMinOpt) subMinOpt.textContent = t.subStyleMinimalist;
    if (subKaraokeOpt) subKaraokeOpt.textContent = t.subStyleKaraoke;

    if (dom.historyTitleLabel) {
        dom.historyTitleLabel.innerHTML = `<i class="fa-solid fa-folder-open"></i> ${t.historyTitle}`;
    }

    document.getElementById('global-lang-select').value = lang;

    // Auto-select a compatible narrator voice for the active language
    // Only switch if the current voice doesn't match the new language
    if (dom.voiceSelect) {
        const currentVoice = dom.voiceSelect.value;
        const isCurrentPt = currentVoice.startsWith('pt-');
        const isCurrentEn = currentVoice.startsWith('en-');
        const isCurrentEs = currentVoice.startsWith('es-');
        const needsSwitch =
            (lang === 'pt' && !isCurrentPt) ||
            (lang === 'en' && !isCurrentEn) ||
            (lang === 'es' && !isCurrentEs);
        if (needsSwitch) {
            if (lang === 'en') {
                dom.voiceSelect.value = 'en-US-AndrewNeural';
            } else if (lang === 'es') {
                dom.voiceSelect.value = 'es-ES-AlvaroNeural';
            } else {
                dom.voiceSelect.value = 'pt-BR-AntonioNeural';
            }
        }
    }
}

// History System
function getSavedNarratives() {
    const data = localStorage.getItem('paradise_narratives');
    if (data) {
        try {
            return JSON.parse(data) || [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

function saveNarrativeToHistory(narrative) {
    let narratives = getSavedNarratives();
    if (!narrative.id) {
        narrative.id = 'narrative_' + Date.now();
    }
    if (!narrative.timestamp) {
        narrative.timestamp = new Date().toLocaleString();
    }
    if (!narrative.genre) {
        narrative.genre = dom.genreSelect.value;
    }
    if (!narrative.duration) {
        narrative.duration = dom.durationSelect.value;
    }
    if (!narrative.voice) {
        narrative.voice = dom.voiceSelect.value;
    }
    const idx = narratives.findIndex(n => n.id === narrative.id);
    if (idx !== -1) {
        narratives[idx] = narrative;
    } else {
        narratives.unshift(narrative);
    }
    if (narratives.length > 10) {
        narratives = narratives.slice(0, 10);
    }
    localStorage.setItem('paradise_narratives', JSON.stringify(narratives));
    renderHistoryList();
}

function deleteNarrativeFromHistory(id, event) {
    if (event) event.stopPropagation();
    const t = getT();
    if (!confirm(t.deleteNarrativeConfirm)) return;
    
    let narratives = getSavedNarratives();
    narratives = narratives.filter(n => n.id !== id);
    localStorage.setItem('paradise_narratives', JSON.stringify(narratives));
    renderHistoryList();
}

function loadNarrativeFromHistory(id) {
    const narratives = getSavedNarratives();
    const narrative = narratives.find(n => n.id === id);
    if (narrative) {
        state.narrativeData = narrative;
        state.currentSceneIdx = 0;
        state.isPlaying = false;
        
        dom.setupPanel.style.display = 'none';
        dom.theaterArena.style.display = 'flex';
        // Apply format from saved narrative (default youtube if not stored)
        const savedFormat = narrative.format || 'youtube';
        state.outputFormat = savedFormat;
        if (savedFormat === 'stories') {
            dom.theaterArena.classList.add('stories-mode');
        } else {
            dom.theaterArena.classList.remove('stories-mode');
        }
        
        dom.storyTitle.textContent = narrative.title || "Narrativa";
        
        const genre = narrative.genre || 'fantasia';
        let genreText = "Fantasia";
        for (let i = 0; i < dom.genreSelect.options.length; i++) {
            if (dom.genreSelect.options[i].value === genre) {
                genreText = dom.genreSelect.options[i].text.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
                break;
            }
        }
        dom.storyBadge.textContent = genreText;
        
        applyAmbientEffects(genre);
        // Apply selected or automatic genre-based effects/animations
        if (dom.horrorEffectSelect) {
            applyHorrorEffect(dom.horrorEffectSelect.value);
        }
        if (dom.imageAnimationSelect) {
            applyImageAnimation(dom.imageAnimationSelect.value);
        }
        renderPlaylist();
        clearAudioCache();   // discard any cached audio from previous story
        clearImageCache();   // discard any cached images from previous story
        loadScene(0);
        updateThumbnailUI();
    }
}

function renderHistoryList() {
    if (!dom.historyPanel || !dom.historyList) return;
    const narratives = getSavedNarratives();
    const t = getT();
    
    if (narratives.length === 0) {
        dom.historyPanel.style.display = 'none';
        return;
    }
    
    dom.historyPanel.style.display = 'block';
    dom.historyList.innerHTML = '';
    
    narratives.forEach(narrative => {
        const card = document.createElement('div');
        card.style.padding = '1.25rem';
        card.style.background = 'rgba(255, 255, 255, 0.03)';
        card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        card.style.borderRadius = '14px';
        card.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.15)';
        card.style.cursor = 'pointer';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.5rem';
        card.style.transition = 'all 0.2s ease-in-out';
        card.style.backdropFilter = 'blur(10px)';
        
        card.onmouseenter = () => {
            card.style.transform = 'translateY(-3px)';
            card.style.borderColor = 'rgba(167, 139, 250, 0.5)';
            card.style.background = 'rgba(167, 139, 250, 0.04)';
            card.style.boxShadow = '0 15px 30px rgba(167, 139, 250, 0.08)';
        };
        card.onmouseleave = () => {
            card.style.transform = 'none';
            card.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            card.style.background = 'rgba(255, 255, 255, 0.03)';
            card.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.15)';
        };
        
        card.onclick = () => loadNarrativeFromHistory(narrative.id);
        
        const title = document.createElement('h4');
        title.style.fontSize = '1.05rem';
        title.style.fontWeight = '600';
        title.style.color = '#f8fafc';
        title.style.margin = '0';
        title.style.lineHeight = '1.3';
        title.textContent = narrative.title || "Narrativa sem título";
        
        const meta = document.createElement('div');
        meta.style.fontSize = '0.8rem';
        meta.style.color = 'var(--text-secondary)';
        meta.style.display = 'flex';
        meta.style.gap = '0.5rem';
        
        const sceneCount = narrative.segments ? narrative.segments.length : 0;
        const durationText = narrative.duration ? `${narrative.duration} ${t.minutesText}` : '';
        meta.innerHTML = `<span style="color: var(--accent-pink);">${sceneCount} ${t.scenesText}</span> · <span>${durationText}</span> · <span>${narrative.timestamp || ''}</span>`;
        
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';
        footer.style.alignItems = 'center';
        footer.style.marginTop = '0.5rem';
        footer.style.gap = '0.5rem';
        
        const genre = narrative.genre || 'fantasia';
        let genreLabel = "Fantasia";
        for (let i = 0; i < dom.genreSelect.options.length; i++) {
            if (dom.genreSelect.options[i].value === genre) {
                genreLabel = dom.genreSelect.options[i].text.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
                break;
            }
        }
        
        const originLabel = document.createElement('span');
        originLabel.style.fontSize = '0.75rem';
        originLabel.style.color = 'rgba(255, 255, 255, 0.4)';
        originLabel.textContent = genreLabel;
        
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
        
        deleteBtn.onclick = (e) => deleteNarrativeFromHistory(narrative.id, e);
        
        footer.appendChild(originLabel);
        footer.appendChild(deleteBtn);
        
        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(footer);
        
        dom.historyList.appendChild(card);
    });
}

/**
 * Composes the thumbnail image with the story title overlaid using Canvas API.
 * Returns a Promise<string> with a data URL (JPEG) of the final composed image.
 */
function composeThumbnailWithTitle(imgSrc, title) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const W = 1280, H = 720;  // YouTube standard thumbnail resolution
            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            // Draw background image
            ctx.drawImage(img, 0, 0, W, H);

            // Gradient overlay for text legibility (bottom half)
            const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(0.4, 'rgba(0,0,0,0.7)');
            grad.addColorStop(1, 'rgba(0,0,0,0.93)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Dynamic font sizing
            const maxWidth = W - 80;
            const lineHeight = 84;
            let fontSize = 74;
            ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
            while (ctx.measureText(title).width > maxWidth && fontSize > 38) {
                fontSize -= 2;
                ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
            }

            // Word-wrap
            function wrapText(text, maxW) {
                const words = text.split(' ');
                const lines = [];
                let cur = '';
                for (const w of words) {
                    const test = cur ? cur + ' ' + w : w;
                    if (ctx.measureText(test).width > maxW && cur) {
                        lines.push(cur);
                        cur = w;
                    } else { cur = test; }
                }
                if (cur) lines.push(cur);
                return lines;
            }

            const lines = wrapText(title.toUpperCase(), maxWidth);
            const totalH = lines.length * lineHeight;
            let y = H - 44 - totalH + lineHeight;

            // Shadow
            ctx.shadowColor = 'rgba(0,0,0,0.98)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 4;

            // Black stroke outline
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = fontSize < 50 ? 6 : 9;
            ctx.lineJoin = 'round';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            // White → yellow gradient fill (YouTube style)
            const tGrad = ctx.createLinearGradient(0, y - lineHeight * 0.8, 0, y + totalH);
            tGrad.addColorStop(0, '#FFFFFF');
            tGrad.addColorStop(1, '#FFE033');

            for (const line of lines) {
                ctx.strokeText(line, 40, y);
                ctx.fillStyle = tGrad;
                ctx.fillText(line, 40, y);
                y += lineHeight;
            }

            ctx.shadowColor = 'transparent';
            resolve(canvas.toDataURL('image/jpeg', 0.93));
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = imgSrc;
    });
}

function updateThumbnailUI() {
    if (!dom.thumbnailImg || !dom.thumbnailPlaceholder) return;
    
    if (state.narrativeData && state.narrativeData.thumbnail_url) {
        let rawUrl = state.narrativeData.thumbnail_url;
        let proxyUrl = rawUrl;
        if (rawUrl && (rawUrl.includes("googleusercontent.com") || rawUrl.includes("google.com"))) {
            proxyUrl = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
        }

        const title = (state.narrativeData.title || '').trim();
        composeThumbnailWithTitle(proxyUrl, title)
            .then(dataUrl => {
                state._composedThumbnailDataUrl = dataUrl;
                dom.thumbnailImg.src = dataUrl;
                dom.thumbnailImg.style.display = 'block';
                dom.thumbnailPlaceholder.style.display = 'none';
                if (dom.btnDownloadThumbnail) dom.btnDownloadThumbnail.disabled = false;
            })
            .catch(() => {
                // Fallback: show raw image without title overlay
                dom.thumbnailImg.src = proxyUrl;
                dom.thumbnailImg.style.display = 'block';
                dom.thumbnailPlaceholder.style.display = 'none';
                if (dom.btnDownloadThumbnail) dom.btnDownloadThumbnail.disabled = false;
            });
    } else {
        resetThumbnailUI();
    }
}

function resetThumbnailUI() {
    if (dom.thumbnailImg) {
        dom.thumbnailImg.src = '';
        dom.thumbnailImg.style.display = 'none';
    }
    if (dom.thumbnailPlaceholder) {
        dom.thumbnailPlaceholder.style.display = 'flex';
        const lang = localStorage.getItem('paradise_language');
        dom.thumbnailPlaceholder.textContent = 
            lang === 'en' ? "No Thumbnail" :
            lang === 'es' ? "Sin Miniatura" :
                            "Sem Thumbnail";
    }
    if (dom.btnDownloadThumbnail) dom.btnDownloadThumbnail.disabled = true;
    state._composedThumbnailDataUrl = null;
}

function applyHorrorEffect(effect) {
    if (!dom.horrorOverlay) return;
    
    // Remove all classes except base 'horror-overlay'
    dom.horrorOverlay.className = 'horror-overlay';
    
    let targetEffect = effect;
    if (effect === 'auto') {
        const genre = (state.narrativeData && state.narrativeData.genre) || '';
        if (genre === 'terror') {
            targetEffect = 'rec';
        } else if (genre === 'suspense') {
            targetEffect = 'vhs';
        } else {
            targetEffect = 'none';
        }
    }
    
    if (targetEffect === 'random') {
        const effects = ['rec', 'ritual', 'vhs', 'insanity'];
        // Pick a random effect, avoiding picking the exact same one if possible (optional, simple random is fine)
        targetEffect = effects[Math.floor(Math.random() * effects.length)];
    }
    
    if (targetEffect && targetEffect !== 'none') {
        dom.horrorOverlay.classList.add(`effect-${targetEffect}`);
        dom.horrorOverlay.classList.add('active');
    }
}

function applyImageAnimation(anim) {
    if (!dom.screenImage) return;
    
    // Remove all animation classes
    dom.screenImage.classList.remove('anim-zoom', 'anim-shake', 'anim-heartbeat', 'anim-blur', 'anim-glitch');
    
    let targetAnim = anim;
    if (anim === 'auto') {
        const genre = (state.narrativeData && state.narrativeData.genre) || '';
        if (genre === 'terror') {
            targetAnim = 'shake';
        } else if (genre === 'suspense') {
            targetAnim = 'zoom';
        } else {
            targetAnim = 'none';
        }
    }
    
    if (targetAnim && targetAnim !== 'none') {
        dom.screenImage.classList.add(`anim-${targetAnim}`);
    }
}

// Bind Thumbnail Events
if (dom.btnChangeThumbnail) {
    dom.btnChangeThumbnail.addEventListener('click', async () => {
        const customPrompt = prompt(
            localStorage.getItem('paradise_language') === 'en' 
                ? "Enter instructions/prompt for the new YouTube thumbnail (or leave blank to regenerate based on story title):" 
                : localStorage.getItem('paradise_language') === 'es'
                    ? "Ingrese instrucciones/prompt para la nueva miniatura de YouTube (o deixe en blanco para regenerar según el título):"
                    : "Digite as instruções/prompt para a nova Thumbnail do YouTube (ou deixe em branco para regenerar baseado no título):"
        );
        if (customPrompt === null) return;
        
        dom.thumbnailPlaceholder.style.display = 'flex';
        dom.thumbnailPlaceholder.textContent = 
            localStorage.getItem('paradise_language') === 'en' ? "Generating..." :
            localStorage.getItem('paradise_language') === 'es' ? "Generando..." :
                                                                "Gerando...";
        dom.thumbnailImg.style.display = 'none';
        dom.btnChangeThumbnail.disabled = true;
        dom.btnDownloadThumbnail.disabled = true;
        
        try {
            const res = await fetch('/api/narrative/regenerate-thumbnail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: state.narrativeData.title,
                    genre: state.narrativeData.genre || 'fantasia',
                    custom_prompt: customPrompt,
                    thumbnail_prompt: state.narrativeData.thumbnail_prompt || ''
                })
            });
            const data = await res.json();
            if (data.thumbnail_url) {
                state.narrativeData.thumbnail_url = data.thumbnail_url;
                updateThumbnailUI();   // re-compose with title overlay
                saveNarrativeToHistory(state.narrativeData);
            } else {
                alert("Erro: " + (data.error || "Nenhuma URL retornada"));
                resetThumbnailUI();
            }
        } catch (err) {
            console.error("Error regenerating thumbnail:", err);
            alert("Erro ao regenerar thumbnail.");
            resetThumbnailUI();
        } finally {
            dom.btnChangeThumbnail.disabled = false;
        }
    });
}

if (dom.btnDownloadThumbnail) {
    dom.btnDownloadThumbnail.addEventListener('click', () => {
        // Prefer the Canvas-composed version (image + title text)
        const dataUrl = state._composedThumbnailDataUrl;
        if (dataUrl) {
            const a = document.createElement('a');
            a.href = dataUrl;
            const safeTitle = (state.narrativeData?.title || 'thumbnail')
                .replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60);
            a.download = `${safeTitle}_thumbnail.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else if (state.narrativeData && state.narrativeData.thumbnail_url) {
            let downloadUrl = state.narrativeData.thumbnail_url;
            if (downloadUrl.includes("googleusercontent.com") || downloadUrl.includes("google.com")) {
                downloadUrl = `/api/proxy-image?url=${encodeURIComponent(downloadUrl)}`;
            }
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'youtube-thumbnail.jpg';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });
}

function loadSavedSettings() {
    // 1. Subtitles Visibility
    const savedSubtitlesVisible = localStorage.getItem('narrative_subtitles_visible');
    if (savedSubtitlesVisible !== null) {
        state.subtitlesVisible = savedSubtitlesVisible === 'true';
    }
    if (dom.btnToggleSubtitles && dom.subtitleOverlay) {
        if (state.subtitlesVisible) {
            dom.subtitleOverlay.style.display = 'block';
            dom.btnToggleSubtitles.style.opacity = '1';
            dom.btnToggleSubtitles.style.color = 'var(--accent-pink)';
        } else {
            dom.subtitleOverlay.style.display = 'none';
            dom.btnToggleSubtitles.style.opacity = '0.5';
            dom.btnToggleSubtitles.style.color = 'var(--text-secondary)';
        }
    }

    // 2. Subtitle Style
    const savedSubtitleStyle = localStorage.getItem('narrative_subtitle_style') || 'classic';
    state.currentSubtitleStyle = savedSubtitleStyle;
    if (dom.subtitleStyleSelect && dom.subtitleOverlay) {
        dom.subtitleStyleSelect.value = savedSubtitleStyle;
        dom.subtitleOverlay.className = 'subtitle-overlay';
        dom.subtitleOverlay.classList.add(`sub-style-${savedSubtitleStyle}`);
    }

    // 3. Horror Effect
    const savedHorrorEffect = localStorage.getItem('narrative_horror_effect');
    if (savedHorrorEffect && dom.horrorEffectSelect) {
        dom.horrorEffectSelect.value = savedHorrorEffect;
        applyHorrorEffect(savedHorrorEffect);
    }

    // 4. Image Animation
    const savedImageAnimation = localStorage.getItem('narrative_image_animation');
    if (savedImageAnimation && dom.imageAnimationSelect) {
        dom.imageAnimationSelect.value = savedImageAnimation;
        applyImageAnimation(savedImageAnimation);
    }

    // 5. Playback Speed
    const savedSpeed = localStorage.getItem('narrative_speed') || '1.0';
    if (dom.speedSelect) {
        dom.speedSelect.value = savedSpeed;
        dom.audioEl.playbackRate = parseFloat(savedSpeed);
    }

    // 6. Volume
    const savedVolume = localStorage.getItem('narrative_volume') || '80';
    if (dom.volumeSlider) {
        dom.volumeSlider.value = savedVolume;
        const vol = parseFloat(savedVolume) / 100;
        dom.audioEl.volume = vol;
        if (vol === 0) {
            dom.volumeIcon.className = "fa-solid fa-volume-xmark";
        } else if (vol < 0.5) {
            dom.volumeIcon.className = "fa-solid fa-volume-low";
        } else {
            dom.volumeIcon.className = "fa-solid fa-volume-high";
        }
    }
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    
    const activeLang = getActiveLanguage();
    applyLanguageUpdates(activeLang);
    renderHistoryList();
    loadSavedSettings();
    
    document.getElementById('global-lang-select').addEventListener('change', (e) => {
        applyLanguageUpdates(e.target.value);
        renderHistoryList();
    });
});
