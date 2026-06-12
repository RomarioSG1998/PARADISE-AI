// narrative/player.js — scene loading, audio/image caching, subtitle loop, playlist
import { state } from './state.js';
import { dom } from './dom.js';
import { getT } from './translations.js';
import { applyHorrorEffect, applyImageAnimation } from './effects.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

// ─── Image Preload Cache ──────────────────────────────────────────────────────

export function resolveImageUrl(rawUrl) {
    if (!rawUrl) return null;
    if (rawUrl.includes('googleusercontent.com') || rawUrl.includes('google.com')) {
        return `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
}

export function preloadImageForScene(idx) {
    if (!state.narrativeData?.segments) return;
    const segments = state.narrativeData.segments;
    if (idx < 0 || idx >= segments.length) return;
    if (state.imageCache.has(idx)) return;

    const rawUrl = segments[idx].image_url;
    const proxyUrl = resolveImageUrl(rawUrl);
    if (!proxyUrl) return;

    const img = new Image();
    img.src = proxyUrl;
    state.imageCache.set(idx, { img, proxyUrl, ready: false });
    img.onload = () => {
        const entry = state.imageCache.get(idx);
        if (entry) entry.ready = true;
    };
}

export function preloadAdjacentImages(currentIdx, ahead = 2) {
    for (let i = 1; i <= ahead; i++) {
        preloadImageForScene(currentIdx + i);
    }
}

export function clearImageCache() {
    state.imageCache.clear();
}

// ─── Audio Preload Cache ──────────────────────────────────────────────────────

export function preloadAudioForScene(idx) {
    if (!state.narrativeData?.segments) return;
    const segments = state.narrativeData.segments;
    if (idx < 0 || idx >= segments.length) return;
    if (state.audioCache.has(idx)) return;

    const segment = segments[idx];
    const voice = dom.voiceSelect.value;
    const url = `/api/narrative/tts?text=${encodeURIComponent(segment.text)}&voice=${encodeURIComponent(voice)}`;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audio.load();
    state.audioCache.set(idx, audio);
}

export function preloadAdjacentScenes(currentIdx, ahead = 2) {
    for (let i = 1; i <= ahead; i++) {
        preloadAudioForScene(currentIdx + i);
    }
}

export function clearAudioCache() {
    state.audioCache.forEach(audio => {
        audio.pause();
        audio.src = '';
    });
    state.audioCache.clear();
}

// ─── Subtitle Loop ────────────────────────────────────────────────────────────

function updateSubtitlesHighlight() {
    if (!dom.audioEl.duration) return;
    const ratio = dom.audioEl.currentTime / dom.audioEl.duration;

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
        if (idx === activeIdx) span.classList.add('highlighted');
        else span.classList.remove('highlighted');
    });
}

export function startSubtitleLoop() {
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    function loop() {
        updateSubtitlesHighlight();
        if (state.isPlaying) {
            state.animationFrameId = requestAnimationFrame(loop);
        }
    }
    state.animationFrameId = requestAnimationFrame(loop);
}

export function stopSubtitleLoop() {
    if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
    }
}

// ─── Playlist ─────────────────────────────────────────────────────────────────

export function renderPlaylist() {
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

// ─── Scene Loading ────────────────────────────────────────────────────────────

export async function loadScene(idx) {
    if (!state.narrativeData || !state.narrativeData.segments || idx < 0 || idx >= state.narrativeData.segments.length) return;

    // Apply visual style skin class
    const screenCanvas = document.querySelector('.screen-canvas');
    if (screenCanvas) {
        const visualTheme = state.narrativeData.visual_theme || 'classic';
        const classesToRemove = [];
        screenCanvas.classList.forEach(cls => {
            if (cls.startsWith('style-')) classesToRemove.push(cls);
        });
        classesToRemove.forEach(cls => screenCanvas.classList.remove(cls));
        screenCanvas.classList.add(`style-${visualTheme}`);
    }

    if (dom.horrorEffectSelect) applyHorrorEffect(dom.horrorEffectSelect.value);

    state.currentSceneIdx = idx;
    const segment = state.narrativeData.segments[idx];
    const t = getT();

    // Highlight sidebar card
    const cards = dom.scenesList.querySelectorAll('.scene-card');
    cards.forEach((c, cIdx) => {
        if (cIdx === idx) c.classList.add('active');
        else c.classList.remove('active');
    });

    dom.btnPrev.disabled = idx === 0;
    dom.btnNext.disabled = idx === state.narrativeData.segments.length - 1;
    dom.sceneCounter.textContent = `Cena ${idx + 1} / ${state.narrativeData.segments.length}`;

    // Scene image — use preloaded cache for instant display
    dom.screenImage.classList.remove('reveal');
    if (segment.image_url) {
        const proxyUrl = resolveImageUrl(segment.image_url);
        const cached = state.imageCache.get(idx);

        if (cached?.ready) {
            dom.screenImage.onload = null;
            dom.screenImage.src = cached.proxyUrl;
            dom.screenBackplate.style.backgroundImage = `url('${cached.proxyUrl}')`;
            requestAnimationFrame(() => {
                dom.screenImage.classList.add('reveal');
                if (dom.imageAnimationSelect) applyImageAnimation(dom.imageAnimationSelect.value);
            });
        } else {
            dom.screenImage.onload = () => {
                dom.screenImage.classList.add('reveal');
                if (dom.imageAnimationSelect) applyImageAnimation(dom.imageAnimationSelect.value);
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

    preloadAdjacentImages(idx);

    // Subtitle timing ranges
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

    // Stop current playback
    dom.audioEl.pause();
    dom.audioEl.src = '';
    state.isPlaying = false;
    dom.btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
    dom.voiceWave.classList.remove('active');
    stopSubtitleLoop();

    dom.timelineSlider.value = 0;
    dom.currentTime.textContent = '00:00';
    dom.totalTime.textContent = '00:00';

    // Audio — use preloaded cache or fetch fresh
    state.audioLoading = true;
    dom.btnPlay.disabled = true;
    dom.subtitleText.innerHTML = `<span style="color: var(--text-secondary); font-style: italic;">${t.audioPreparando}</span>`;

    preloadAdjacentScenes(idx);

    try {
        const voice = dom.voiceSelect.value;

        const activateAudio = (audioEl) => {
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
            activateAudio(state.audioCache.get(idx));
        } else {
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
        dom.subtitleText.textContent = segment.text + ` ${getT().audioErro}`;
        state.audioLoading = false;
    }
}
