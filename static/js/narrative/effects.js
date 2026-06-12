// narrative/effects.js — ambient particles, horror & image animations
import { state } from './state.js';
import { dom } from './dom.js';

/**
 * Applies genre-specific ambient particle effects to the ambient layer.
 */
export function applyAmbientEffects(genre) {
    if (!dom.ambientLayer) return;
    dom.ambientLayer.className = `ambient-layer ${genre}`;
    dom.ambientLayer.innerHTML = '';

    let count = 0;
    let className = '';

    if (genre === 'terror') {
        count = 15; className = 'red-ember';
    } else if (genre === 'infantil') {
        count = 12; className = 'pastel-bubble';
    } else if (genre === 'fantasia') {
        count = 18; className = 'sparkle-light';
    } else if (genre === 'scifi') {
        count = 15; className = 'digital-pixel';
    } else if (genre === 'suspense') {
        count = 10; className = 'misty-smoke';
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

/**
 * Applies a horror overlay effect based on the selected or auto-detected genre.
 */
export function applyHorrorEffect(effect) {
    if (!dom.horrorOverlay) return;
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
        targetEffect = effects[Math.floor(Math.random() * effects.length)];
    }

    if (targetEffect && targetEffect !== 'none') {
        dom.horrorOverlay.classList.add(`effect-${targetEffect}`);
        dom.horrorOverlay.classList.add('active');
    }
}

/**
 * Applies a CSS animation class to the screen image.
 */
export function applyImageAnimation(anim) {
    if (!dom.screenImage) return;
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
