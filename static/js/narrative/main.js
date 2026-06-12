/* =========================================================================
   narrative/main.js — Orchestrator: wires all modules together
   =========================================================================
   Modules:
     state.js        — shared mutable state
     dom.js          — cached DOM element references
     translations.js — i18n strings + language helpers
     effects.js      — ambient particles, horror & image animations
     player.js       — scene loading, audio/image caching, subtitle loop
     history.js      — localStorage narrative history management
     thumbnail.js    — YouTube thumbnail composition and UI
     i18n.js         — full UI language update logic
     exporter.js     — screen recording / video export
   ========================================================================= */

import { attachVoiceInput } from '../voice_input.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { getActiveLanguage, getT } from './translations.js';
import { applyAmbientEffects, applyHorrorEffect, applyImageAnimation } from './effects.js';
import {
    loadScene, renderPlaylist,
    startSubtitleLoop, stopSubtitleLoop, formatTime,
    clearAudioCache, clearImageCache
} from './player.js';
import { saveNarrativeToHistory, renderHistoryList, setOnThumbnailCallback } from './history.js';
import { updateThumbnailUI, resetThumbnailUI, setupThumbnailEvents } from './thumbnail.js';
import { applyLanguageUpdates } from './i18n.js';
import { setupExporter } from './exporter.js';

// ─── Form Validation ──────────────────────────────────────────────────────────
function checkInputs() {
    let valid = false;
    if (state.currentType === 'theme' && dom.themeInput.value.trim() !== '') valid = true;
    else if (state.currentType === 'text' && dom.textInput.value.trim() !== '') valid = true;
    else if (state.currentType === 'pdf' && state.selectedPdfFile !== null) valid = true;
    dom.btnGenerate.disabled = !valid;
}

// ─── PDF File Handler ─────────────────────────────────────────────────────────
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

// ─── Persisted Settings ───────────────────────────────────────────────────────
function loadSavedSettings() {
    const savedSubVis = localStorage.getItem('narrative_subtitles_visible');
    if (savedSubVis !== null) state.subtitlesVisible = savedSubVis === 'true';
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

    const savedSubStyle = localStorage.getItem('narrative_subtitle_style') || 'classic';
    state.currentSubtitleStyle = savedSubStyle;
    if (dom.subtitleStyleSelect && dom.subtitleOverlay) {
        dom.subtitleStyleSelect.value = savedSubStyle;
        dom.subtitleOverlay.className = 'subtitle-overlay';
        dom.subtitleOverlay.classList.add(`sub-style-${savedSubStyle}`);
    }

    const savedHorror = localStorage.getItem('narrative_horror_effect');
    if (savedHorror && dom.horrorEffectSelect) {
        dom.horrorEffectSelect.value = savedHorror;
        applyHorrorEffect(savedHorror);
    }

    const savedAnim = localStorage.getItem('narrative_image_animation');
    if (savedAnim && dom.imageAnimationSelect) {
        dom.imageAnimationSelect.value = savedAnim;
        applyImageAnimation(savedAnim);
    }

    const savedSpeed = localStorage.getItem('narrative_speed') || '1.0';
    if (dom.speedSelect) {
        dom.speedSelect.value = savedSpeed;
        dom.audioEl.playbackRate = parseFloat(savedSpeed);
    }

    const savedVolume = localStorage.getItem('narrative_volume') || '80';
    if (dom.volumeSlider) {
        dom.volumeSlider.value = savedVolume;
        const vol = parseFloat(savedVolume) / 100;
        dom.audioEl.volume = vol;
        dom.volumeIcon.className = vol === 0 ? "fa-solid fa-volume-xmark" :
                                   vol < 0.5  ? "fa-solid fa-volume-low" :
                                                "fa-solid fa-volume-high";
    }
}

// ─── Voice Preview ────────────────────────────────────────────────────────────
function setupVoicePreview() {
    if (!dom.btnPreviewVoice) return;
    let previewAudioEl = new Audio();

    dom.btnPreviewVoice.addEventListener('click', () => {
        if (!previewAudioEl.paused && previewAudioEl.src) {
            previewAudioEl.pause();
            dom.btnPreviewVoice.innerHTML = '<i class="fa-solid fa-play"></i>';
            return;
        }

        const voice = dom.voiceSelect.value;
        let sampleText = "Olá, eu sou o narrador que você escolheu. Esta é uma breve demonstração da minha voz e entonação para a sua história.";
        if (voice.startsWith('en-')) sampleText = "Hello, I am the narrator you selected. This is a brief demonstration of my voice and intonation for your story.";
        else if (voice.startsWith('es-')) sampleText = "Hola, soy el narrador que has elegido. Esta es una breve demostración de mi voz y entonación para tu historia.";

        dom.btnPreviewVoice.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        previewAudioEl.src = `/api/narrative/tts?text=${encodeURIComponent(sampleText)}&voice=${encodeURIComponent(voice)}`;

        previewAudioEl.play().then(() => {
            dom.btnPreviewVoice.innerHTML = '<i class="fa-solid fa-pause"></i>';
        }).catch(e => {
            console.error("Preview failed", e);
            dom.btnPreviewVoice.innerHTML = '<i class="fa-solid fa-play"></i>';
            alert("Falha ao carregar preview da voz.");
        });

        previewAudioEl.onended = () => {
            dom.btnPreviewVoice.innerHTML = '<i class="fa-solid fa-play"></i>';
        };
    });

    dom.voiceSelect.addEventListener('change', () => {
        if (!previewAudioEl.paused) {
            previewAudioEl.pause();
            dom.btnPreviewVoice.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    });
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────
function setupFullscreen() {
    if (!dom.btnFullscreen) return;
    let hideControlsTimeout;
    const controls = document.querySelector('.media-controls');

    const hideControls = () => {
        if (controls) { controls.style.opacity = '0'; controls.style.pointerEvents = 'none'; }
        document.body.style.cursor = 'none';
    };
    const showControls = () => {
        if (controls) { controls.style.opacity = '1'; controls.style.pointerEvents = 'auto'; }
        document.body.style.cursor = 'default';
        clearTimeout(hideControlsTimeout);
        if (document.fullscreenElement) hideControlsTimeout = setTimeout(hideControls, 3000);
    };

    dom.btnFullscreen.addEventListener('click', () => {
        const container = document.querySelector('.theater-screen');
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
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
            hideControls();
        } else {
            dom.btnFullscreen.innerHTML = '<i class="fa-solid fa-expand"></i>';
            if (container) container.removeEventListener('mousemove', showControls);
            clearTimeout(hideControlsTimeout);
            if (controls) { controls.style.opacity = '1'; controls.style.pointerEvents = 'auto'; }
            document.body.style.cursor = 'default';
        }
    });
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupEvents() {
    dom.themeInput.addEventListener('input', checkInputs);
    dom.textInput.addEventListener('input', checkInputs);

    // Tab switcher
    document.querySelectorAll('.type-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentType = tab.getAttribute('data-type');
            document.getElementById('group-theme').style.display = state.currentType === 'theme' ? 'flex' : 'none';
            document.getElementById('group-text').style.display = state.currentType === 'text' ? 'flex' : 'none';
            document.getElementById('group-pdf').style.display = state.currentType === 'pdf' ? 'flex' : 'none';
            checkInputs();
        });
    });

    // PDF drag & drop
    dom.pdfDropZone.addEventListener('click', () => dom.pdfFileInput.click());
    dom.pdfFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handlePdfFile(e.target.files[0]);
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
        if (e.dataTransfer.files.length > 0) handlePdfFile(e.dataTransfer.files[0]);
    });

    // Generate
    dom.btnGenerate.addEventListener('click', async () => {
        const t = getT();
        dom.setupPanel.style.display = 'none';
        dom.loadingPanel.style.display = 'flex';
        dom.loadingStepTitle.textContent = t.stepRoteiro;
        dom.loadingStepDesc.textContent = t.stepRoteiroDesc;

        const formData = new FormData();
        formData.append('type', state.currentType);
        formData.append('genre', dom.genreSelect.value);
        formData.append('visual_theme', dom.visualThemeSelect ? dom.visualThemeSelect.value : 'classic');
        formData.append('duration', dom.durationSelect.value);
        formData.append('voice', dom.voiceSelect.value);
        formData.append('language', getActiveLanguage());
        formData.append('format', state.outputFormat);

        if (state.currentType === 'theme') formData.append('content', dom.themeInput.value.trim());
        else if (state.currentType === 'text') formData.append('content', dom.textInput.value.trim());
        else if (state.currentType === 'pdf') formData.append('file', state.selectedPdfFile);

        const stepInterval = setTimeout(() => {
            if (dom.loadingPanel.style.display === 'flex') {
                dom.loadingStepTitle.textContent = t.stepImagens;
                dom.loadingStepDesc.textContent = t.stepImagensDesc;
            }
        }, 9000);

        try {
            const resp = await fetch('/api/narrative/generate', { method: 'POST', body: formData });
            if (!resp.ok) throw new Error(await resp.text());

            state.narrativeData = await resp.json();
            clearTimeout(stepInterval);
            dom.loadingPanel.style.display = 'none';
            dom.theaterArena.style.display = 'flex';

            if (state.outputFormat === 'stories') {
                dom.theaterArena.classList.add('stories-mode');
                dom.theaterScreen?.classList.add('stories-mode');
            } else {
                dom.theaterArena.classList.remove('stories-mode');
                dom.theaterScreen?.classList.remove('stories-mode');
            }

            dom.storyTitle.textContent = state.narrativeData.title || "Narrativa";
            dom.storyBadge.textContent = dom.genreSelect.options[dom.genreSelect.selectedIndex].text.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();

            applyAmbientEffects(dom.genreSelect.value);
            if (dom.horrorEffectSelect) applyHorrorEffect(dom.horrorEffectSelect.value);
            if (dom.imageAnimationSelect) applyImageAnimation(dom.imageAnimationSelect.value);

            renderPlaylist();
            clearAudioCache();
            clearImageCache();
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

    // Play/Pause
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
        if (state.currentSceneIdx > 0) loadScene(state.currentSceneIdx - 1);
    });
    dom.btnNext.addEventListener('click', () => {
        if (state.currentSceneIdx < state.narrativeData.segments.length - 1) loadScene(state.currentSceneIdx + 1);
    });

    // Timeline seek
    dom.timelineSlider.addEventListener('input', () => {
        if (dom.audioEl.duration) {
            dom.audioEl.currentTime = (dom.timelineSlider.value / 100) * dom.audioEl.duration;
        }
    });

    // Audio time update
    dom.audioEl.addEventListener('timeupdate', () => {
        if (dom.audioEl.duration) {
            const current = dom.audioEl.currentTime;
            const duration = dom.audioEl.duration;
            dom.timelineSlider.value = (current / duration) * 100;
            dom.currentTime.textContent = formatTime(current);
            dom.totalTime.textContent = formatTime(duration);
        }
    });

    // Auto-advance to next scene
    dom.audioEl.addEventListener('ended', () => {
        dom.btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        dom.voiceWave.classList.remove('active');
        state.isPlaying = false;
        stopSubtitleLoop();

        if (state.autoPlayEnabled && state.currentSceneIdx < state.narrativeData.segments.length - 1) {
            const endedScene = state.currentSceneIdx;
            setTimeout(() => {
                if (state.currentSceneIdx === endedScene) loadScene(state.currentSceneIdx + 1);
            }, 200);
        }
    });

    // Volume control
    dom.volumeSlider.addEventListener('input', () => {
        const vol = dom.volumeSlider.value / 100;
        dom.audioEl.volume = vol;
        dom.volumeIcon.className = vol === 0 ? "fa-solid fa-volume-xmark" :
                                   vol < 0.5  ? "fa-solid fa-volume-low" :
                                                "fa-solid fa-volume-high";
        localStorage.setItem('narrative_volume', dom.volumeSlider.value);
    });

    // Speed
    dom.speedSelect.addEventListener('change', () => {
        dom.audioEl.playbackRate = parseFloat(dom.speedSelect.value);
        localStorage.setItem('narrative_speed', dom.speedSelect.value);
    });

    // New story reset
    dom.btnNewStory.addEventListener('click', () => {
        dom.audioEl.pause();
        dom.audioEl.src = '';
        state.isPlaying = false;
        stopSubtitleLoop();
        dom.theaterArena.style.display = 'none';
        dom.theaterArena.classList.remove('stories-mode');
        dom.setupPanel.style.display = 'flex';
        dom.themeInput.value = '';
        dom.textInput.value = '';
        state.selectedPdfFile = null;
        dom.pdfFileInput.value = '';
        dom.selectedFilename.style.display = 'none';
        dom.btnGenerate.disabled = true;
        resetThumbnailUI();
    });

    // Subtitle toggle
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

    // Subtitle style
    if (dom.subtitleStyleSelect) {
        dom.subtitleStyleSelect.addEventListener('change', () => {
            const style = dom.subtitleStyleSelect.value;
            dom.subtitleOverlay.classList.remove('sub-style-classic', 'sub-style-neon', 'sub-style-minimalist', 'sub-style-karaoke');
            dom.subtitleOverlay.classList.add(`sub-style-${style}`);
            state.currentSubtitleStyle = style;
            localStorage.setItem('narrative_subtitle_style', style);
        });
    }

    // Voice input (mic dictation)
    if (dom.btnMicTheme && dom.themeInput) {
        attachVoiceInput(dom.themeInput, dom.btnMicTheme, getActiveLanguage);
        dom.themeInput.addEventListener('change', checkInputs);
    }
    if (dom.btnMicText && dom.textInput) {
        attachVoiceInput(dom.textInput, dom.btnMicText, getActiveLanguage);
        dom.textInput.addEventListener('change', checkInputs);
    }

    // Format selector (YouTube / Stories)
    [dom.formatBtnYoutube, dom.formatBtnStories].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', () => {
            dom.formatBtnYoutube?.classList.remove('active');
            dom.formatBtnStories?.classList.remove('active');
            btn.classList.add('active');
            state.outputFormat = btn.dataset.format;

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

    // Horror effect
    if (dom.horrorEffectSelect) {
        dom.horrorEffectSelect.addEventListener('change', () => {
            applyHorrorEffect(dom.horrorEffectSelect.value);
            localStorage.setItem('narrative_horror_effect', dom.horrorEffectSelect.value);
        });
    }

    // Image animation
    if (dom.imageAnimationSelect) {
        dom.imageAnimationSelect.addEventListener('change', () => {
            applyImageAnimation(dom.imageAnimationSelect.value);
            localStorage.setItem('narrative_image_animation', dom.imageAnimationSelect.value);
        });
    }

    // Voice select clears audio cache
    if (dom.voiceSelect) {
        dom.voiceSelect.addEventListener('change', () => clearAudioCache());
    }

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
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
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Wire updateThumbnailUI into history module (avoids circular dependency)
    setOnThumbnailCallback(updateThumbnailUI);
    setupEvents();
    setupFullscreen();
    setupVoicePreview();
    setupThumbnailEvents();
    setupExporter();

    const activeLang = getActiveLanguage();
    applyLanguageUpdates(activeLang);
    renderHistoryList();
    loadSavedSettings();

    document.getElementById('global-lang-select').addEventListener('change', (e) => {
        applyLanguageUpdates(e.target.value);
        renderHistoryList();
    });
});
