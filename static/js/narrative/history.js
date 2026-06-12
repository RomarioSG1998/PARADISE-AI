// narrative/history.js — localStorage-based narrative history management
// Note: no import from thumbnail.js to avoid circular dependency.
// updateThumbnailUI is injected via setOnThumbnailCallback() from main.js.
import { state } from './state.js';
import { dom } from './dom.js';
import { getT } from './translations.js';
import { applyAmbientEffects, applyHorrorEffect, applyImageAnimation } from './effects.js';
import { renderPlaylist, loadScene, clearAudioCache, clearImageCache } from './player.js';

/** Callback injected from main.js to avoid circular dep with thumbnail.js */
let _onThumbnail = null;
export function setOnThumbnailCallback(fn) { _onThumbnail = fn; }

export function getSavedNarratives() {
    const data = localStorage.getItem('paradise_narratives');
    if (data) {
        try { return JSON.parse(data) || []; } catch (e) { return []; }
    }
    return [];
}

export function saveNarrativeToHistory(narrative) {
    let narratives = getSavedNarratives();
    if (!narrative.id) narrative.id = 'narrative_' + Date.now();
    if (!narrative.timestamp) narrative.timestamp = new Date().toLocaleString();
    if (!narrative.genre) narrative.genre = dom.genreSelect.value;
    if (!narrative.visual_theme) narrative.visual_theme = dom.visualThemeSelect ? dom.visualThemeSelect.value : 'classic';
    if (!narrative.duration) narrative.duration = dom.durationSelect.value;
    if (!narrative.voice) narrative.voice = dom.voiceSelect.value;

    const idx = narratives.findIndex(n => n.id === narrative.id);
    if (idx !== -1) narratives[idx] = narrative;
    else narratives.unshift(narrative);

    if (narratives.length > 10) narratives = narratives.slice(0, 10);
    localStorage.setItem('paradise_narratives', JSON.stringify(narratives));
    renderHistoryList();
}

export function deleteNarrativeFromHistory(id, event) {
    if (event) event.stopPropagation();
    const t = getT();
    if (!confirm(t.deleteNarrativeConfirm)) return;

    let narratives = getSavedNarratives();
    narratives = narratives.filter(n => n.id !== id);
    localStorage.setItem('paradise_narratives', JSON.stringify(narratives));
    renderHistoryList();
}

/**
 * @param {string} id - narrative ID to load
 * @param {Function} onThumbnail - callback to call updateThumbnailUI after load (avoids circular dep)
 */
export function loadNarrativeFromHistory(id, onThumbnail) {
    const narratives = getSavedNarratives();
    const narrative = narratives.find(n => n.id === id);
    if (!narrative) return;

    state.narrativeData = narrative;
    state.currentSceneIdx = 0;
    state.isPlaying = false;

    dom.setupPanel.style.display = 'none';
    dom.theaterArena.style.display = 'flex';

    const savedFormat = narrative.format || 'youtube';
    state.outputFormat = savedFormat;
    if (savedFormat === 'stories') {
        dom.theaterArena.classList.add('stories-mode');
        dom.theaterScreen?.classList.add('stories-mode');
    } else {
        dom.theaterArena.classList.remove('stories-mode');
        dom.theaterScreen?.classList.remove('stories-mode');
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
    if (dom.horrorEffectSelect) applyHorrorEffect(dom.horrorEffectSelect.value);
    if (dom.imageAnimationSelect) applyImageAnimation(dom.imageAnimationSelect.value);

    renderPlaylist();
    clearAudioCache();
    clearImageCache();
    loadScene(0);
    const cb = typeof onThumbnail === 'function' ? onThumbnail : _onThumbnail;
    if (typeof cb === 'function') cb();
}

export function renderHistoryList() {
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
        Object.assign(card.style, {
            padding: '1.25rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            boxShadow: '0 10px 20px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            transition: 'all 0.2s ease-in-out',
            backdropFilter: 'blur(10px)'
        });

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

        card.onclick = () => loadNarrativeFromHistory(narrative.id, _onThumbnail);

        const title = document.createElement('h4');
        Object.assign(title.style, { fontSize: '1.05rem', fontWeight: '600', color: '#f8fafc', margin: '0', lineHeight: '1.3' });
        title.textContent = narrative.title || "Narrativa sem título";

        const meta = document.createElement('div');
        Object.assign(meta.style, { fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' });
        const sceneCount = narrative.segments ? narrative.segments.length : 0;
        const durationText = narrative.duration ? `${narrative.duration} ${t.minutesText}` : '';
        meta.innerHTML = `<span style="color: var(--accent-pink);">${sceneCount} ${t.scenesText}</span> · <span>${durationText}</span> · <span>${narrative.timestamp || ''}</span>`;

        const footer = document.createElement('div');
        Object.assign(footer.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', gap: '0.5rem' });

        const genre = narrative.genre || 'fantasia';
        let genreLabel = "Fantasia";
        for (let i = 0; i < dom.genreSelect.options.length; i++) {
            if (dom.genreSelect.options[i].value === genre) {
                genreLabel = dom.genreSelect.options[i].text.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
                break;
            }
        }

        const originLabel = document.createElement('span');
        Object.assign(originLabel.style, { fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)' });
        originLabel.textContent = genreLabel;

        const deleteBtn = document.createElement('button');
        Object.assign(deleteBtn.style, {
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444', padding: '0.35rem 0.65rem', fontSize: '0.8rem',
            borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s'
        });
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.onmouseenter = () => { deleteBtn.style.background = 'rgba(239, 68, 68, 0.2)'; };
        deleteBtn.onmouseleave = () => { deleteBtn.style.background = 'rgba(239, 68, 68, 0.1)'; };
        deleteBtn.onclick = (e) => deleteNarrativeFromHistory(narrative.id, e);

        footer.appendChild(originLabel);
        footer.appendChild(deleteBtn);

        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(footer);
        dom.historyList.appendChild(card);
    });
}
