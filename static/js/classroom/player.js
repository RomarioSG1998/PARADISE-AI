import { state } from './state.js';
import { elements } from './elements.js';
import { classTranslations } from './translations.js';

export function updateAutoPlayUI() {
    const lang = localStorage.getItem('paradise_language') || 'pt';
    const t = classTranslations[lang] || classTranslations.pt;
    if (state.autoPlayEnabled) {
        elements.btnAutoPlay.title = t.autoPlayActive || "Reprodução Automática: Ativada";
        elements.autoPlayIcon.className = "fa-solid fa-toggle-on";
        elements.btnAutoPlay.style.color = "#a78bfa";
        elements.btnAutoPlay.style.borderColor = "rgba(167, 139, 250, 0.6)";
        elements.btnAutoPlay.style.boxShadow = "0 0 10px rgba(167, 139, 250, 0.4)";
    } else {
        elements.btnAutoPlay.title = t.autoPlayInactive || "Reprodução Automática: Desativada";
        elements.autoPlayIcon.className = "fa-solid fa-toggle-off";
        elements.btnAutoPlay.style.color = "var(--text-secondary)";
        elements.btnAutoPlay.style.borderColor = "rgba(255, 255, 255, 0.08)";
        elements.btnAutoPlay.style.boxShadow = "none";
    }
}

export function renderLesson() {
    if (!state.lessonData) return;
    elements.classroomSubjectTitle.textContent = state.lessonData.subject || "Aula Paradise AI";
    
    const thumbBtn = document.getElementById('btn-download-classroom-thumbnail');
    if (thumbBtn) {
        if (state.lessonData.thumbnail_url) {
            thumbBtn.style.display = 'inline-flex';
            let rawUrl = state.lessonData.thumbnail_url;
            let proxyUrl = rawUrl;
            if (rawUrl && (rawUrl.includes("googleusercontent.com") || rawUrl.includes("google.com"))) {
                proxyUrl = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
            }
            
            composeThumbnailWithTitle(proxyUrl, state.lessonData.subject || 'Aula').then(dataUrl => {
                thumbBtn.href = dataUrl;
                thumbBtn.download = "classroom-thumbnail.jpg";
            }).catch(e => {
                console.error("Thumbnail compose error:", e);
                thumbBtn.href = proxyUrl;
                thumbBtn.download = "classroom-thumbnail.jpg";
            });
        } else {
            thumbBtn.style.display = 'none';
        }
    }

    localStorage.setItem('paradise_active_lesson', JSON.stringify(state.lessonData));
    loadSlide(state.currentSlideIdx);
}

export async function loadSlide(idx) {
    if (!state.lessonData || !state.lessonData.slides || idx < 0 || idx >= state.lessonData.slides.length) return;
    localStorage.setItem('paradise_active_lesson_slide', idx);
    
    state.currentSlideIdx = idx;
    const slide = state.lessonData.slides[idx];
    
    const boardEl = document.querySelector('.blackboard');
    if (boardEl) {
        boardEl.classList.remove('style-classic', 'style-realistic', 'style-medieval', 'style-caveman', 'style-anime', 'style-disney');
        const lessonStyle = state.lessonData.style || 'classic';
        boardEl.classList.add(`style-${lessonStyle}`);
    }
    
    // UI Navigation availability
    elements.btnPrev.disabled = idx === 0;
    elements.btnNext.disabled = idx === state.lessonData.slides.length - 1;
    elements.slideIndicator.textContent = `Slide ${idx + 1} / ${state.lessonData.slides.length}`;
    
    // Render text
    elements.boardSlideTitle.textContent = `${idx + 1}. ${slide.title}`;
    if (window.renderMathInElement) {
        renderMathInElement(elements.boardSlideTitle, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false
        });
    }
    
    // Split narration and calculate character-weighted ranges
    const words = slide.narration.split(' ');
    let totalChars = words.reduce((acc, w) => acc + w.length, 0);
    let currentSum = 0;
    state.wordRanges = words.map(w => {
        let start = currentSum / totalChars;
        currentSum += w.length;
        let end = currentSum / totalChars;
        return { start, end };
    });
    
    elements.teleprompterSubtitles.innerHTML = words.map((w, wIdx) => `<span class="sub-word" id="word-${wIdx}">${w}</span>`).join(' ');
    
    // Render bullet points
    elements.boardBullets.innerHTML = '';
    slide.bullets.forEach((bullet, i) => {
        const li = document.createElement('li');
        li.textContent = bullet;
        if (window.renderMathInElement) {
            renderMathInElement(li, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        }
        elements.boardBullets.appendChild(li);
        // Stagger reveal animation
        setTimeout(() => {
            li.classList.add('reveal');
        }, i * 600 + 400);
    });
    
    // Render chalkboard drawing
    elements.boardImage.className = 'loading';
    elements.downloadBoardBtn.style.display = 'none';
    if (slide.image_url) {
        let rawUrl = slide.image_url;
        let proxyUrl = rawUrl;
        if (rawUrl && (rawUrl.includes("googleusercontent.com") || rawUrl.includes("google.com"))) {
            proxyUrl = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
        }
        
        elements.boardImage.onload = () => {
            elements.boardImage.className = '';
            elements.downloadBoardBtn.href = proxyUrl;
            elements.downloadBoardBtn.style.display = 'flex';
        };
        elements.boardImage.src = proxyUrl;
        elements.boardImage.onclick = () => window.open(rawUrl, '_blank');
        elements.boardImage.style.cursor = 'pointer';
    } else {
        elements.boardImage.src = '';
    }
    
    // Reset Audio
    elements.audioEl.pause();
    elements.audioEl.src = '';
    elements.teacherAvatar.classList.remove('speaking');
    window.isSpeaking3D = false;
    state.isPlaying = false;
    stopSubtitleLoop();
    elements.playIcon.className = 'fa-solid fa-play';
    elements.progressBar.value = 0;
    elements.currentTimeEl.textContent = '0:00';
    elements.durationTimeEl.textContent = '0:00';
    
    // Fetch Audio
    state.audioLoading = true;
    elements.btnPlay.disabled = true;
    elements.teleprompterSubtitles.innerHTML = `<span style="color: var(--text-secondary); font-style: italic;">Preparando a voz do professor para este quadro...</span>`;
    
    try {
        const globalLang = localStorage.getItem('paradise_language') || 'pt';
        
        const handleCanPlayThrough = () => {
            elements.audioEl.oncanplaythrough = null;
            state.audioLoading = false;
            elements.btnPlay.disabled = false;
            
            // Restore words
            elements.teleprompterSubtitles.innerHTML = words.map((w, wIdx) => `<span class="sub-word" id="word-${wIdx}">${w}</span>`).join(' ');
            
            // Set speed rate
            const speed = elements.speedSlider.value / 10;
            elements.audioEl.playbackRate = speed;
            
            // Auto-start play
            elements.audioEl.play().then(() => {
                elements.playIcon.className = 'fa-solid fa-pause';
                elements.teacherAvatar.classList.add('speaking');
                window.isSpeaking3D = true;
                state.isPlaying = true;
                startSubtitleLoop();
            }).catch((err) => {
                console.warn("Autoplay blocked:", err);
                elements.playIcon.className = 'fa-solid fa-play';
                elements.teacherAvatar.classList.remove('speaking');
                window.isSpeaking3D = false;
                state.isPlaying = false;
            });
        };

        elements.audioEl.oncanplaythrough = handleCanPlayThrough;
        elements.audioEl.src = `/api/tts?text=${encodeURIComponent(slide.narration)}&lang=${globalLang}`;
        elements.audioEl.load();

        if (elements.audioEl.readyState >= 4) {
            handleCanPlayThrough();
        }
    } catch (e) {
        console.error("Failed to load audio for slide", e);
        elements.teleprompterSubtitles.textContent = slide.narration + " (Áudio indisponível)";
        state.audioLoading = false;
    }
}

export function updateSubtitlesHighlight() {
    if (!elements.audioEl.duration) return;
    const current = elements.audioEl.currentTime;
    const duration = elements.audioEl.duration;
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
    
    const spans = elements.teleprompterSubtitles.querySelectorAll('.sub-word');
    spans.forEach((span, idx) => {
        if (idx === activeIdx) {
            span.classList.add('highlighted');
            span.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } else {
            span.classList.remove('highlighted');
        }
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

export function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}


export async function loadExplanation(explanation) {
    // Stop current audio/subtitles
    elements.audioEl.pause();
    elements.audioEl.src = '';
    elements.teacherAvatar.classList.remove('speaking');
    window.isSpeaking3D = false;
    state.isPlaying = false;
    stopSubtitleLoop();
    elements.playIcon.className = 'fa-solid fa-play';
    elements.progressBar.value = 0;
    elements.currentTimeEl.textContent = '0:00';
    elements.durationTimeEl.textContent = '0:00';

    state.explanationActive = true;
    
    const boardEl = document.querySelector('.blackboard');
    if (boardEl) {
        boardEl.classList.remove('style-classic', 'style-realistic', 'style-medieval', 'style-caveman', 'style-anime', 'style-disney');
        const lessonStyle = (state.lessonData && state.lessonData.style) || 'classic';
        boardEl.classList.add(`style-${lessonStyle}`);
    }
    
    // Update headers and return buttons
    if (elements.btnReturnLesson) elements.btnReturnLesson.style.display = 'block';
    
    // Disable slide controls
    elements.btnPrev.disabled = true;
    elements.btnNext.disabled = true;
    
    elements.boardSlideTitle.textContent = explanation.title || "Explicação do Professor";
    if (window.renderMathInElement) {
        renderMathInElement(elements.boardSlideTitle, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false
        });
    }
    
    // Render explanation bullets
    elements.boardBullets.innerHTML = '';
    const bullets = explanation.bullets || [];
    bullets.forEach((bullet, i) => {
        const li = document.createElement('li');
        li.textContent = bullet;
        if (window.renderMathInElement) {
            renderMathInElement(li, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        }
        elements.boardBullets.appendChild(li);
        setTimeout(() => {
            li.classList.add('reveal');
        }, i * 600 + 400);
    });

    // Render explanation illustration
    elements.boardImage.className = 'loading';
    elements.downloadBoardBtn.style.display = 'none';
    if (explanation.image_url) {
        let rawUrl = explanation.image_url;
        let proxyUrl = rawUrl;
        if (rawUrl && (rawUrl.includes("googleusercontent.com") || rawUrl.includes("google.com"))) {
            proxyUrl = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
        }
        elements.boardImage.onload = () => {
            elements.boardImage.className = '';
            elements.downloadBoardBtn.href = proxyUrl;
            elements.downloadBoardBtn.style.display = 'flex';
        };
        elements.boardImage.src = proxyUrl;
        elements.boardImage.onclick = () => window.open(rawUrl, '_blank');
        elements.boardImage.style.cursor = 'pointer';
    } else {
        elements.boardImage.src = '';
    }

    // Prepare Narration
    const narration = explanation.narration || '';
    const words = narration.split(' ');
    let totalChars = words.reduce((acc, w) => acc + w.length, 0);
    let currentSum = 0;
    state.wordRanges = words.map(w => {
        let start = currentSum / totalChars;
        currentSum += w.length;
        let end = currentSum / totalChars;
        return { start, end };
    });
    
    elements.teleprompterSubtitles.innerHTML = words.map((w, wIdx) => `<span class="sub-word" id="word-${wIdx}">${w}</span>`).join(' ');

    state.audioLoading = true;
    elements.btnPlay.disabled = true;
    elements.teleprompterSubtitles.innerHTML = `<span style="color: var(--text-secondary); font-style: italic;">Preparando explicação...</span>`;

    try {
        const globalLang = localStorage.getItem('paradise_language') || 'pt';
        
        const handleCanPlayThrough = () => {
            elements.audioEl.oncanplaythrough = null;
            state.audioLoading = false;
            elements.btnPlay.disabled = false;
            
            // Restore words
            elements.teleprompterSubtitles.innerHTML = words.map((w, wIdx) => `<span class="sub-word" id="word-${wIdx}">${w}</span>`).join(' ');
            
            const speed = elements.speedSlider.value / 10;
            elements.audioEl.playbackRate = speed;
            
            elements.audioEl.play().then(() => {
                elements.playIcon.className = 'fa-solid fa-pause';
                elements.teacherAvatar.classList.add('speaking');
                window.isSpeaking3D = true;
                state.isPlaying = true;
                startSubtitleLoop();
            }).catch((err) => {
                console.warn("Autoplay blocked:", err);
                elements.playIcon.className = 'fa-solid fa-play';
                elements.teacherAvatar.classList.remove('speaking');
                window.isSpeaking3D = false;
                state.isPlaying = false;
            });
        };

        elements.audioEl.oncanplaythrough = handleCanPlayThrough;
        elements.audioEl.src = `/api/tts?text=${encodeURIComponent(narration)}&lang=${globalLang}`;
        elements.audioEl.load();

        if (elements.audioEl.readyState >= 4) {
            handleCanPlayThrough();
        }
    } catch (e) {
        console.error("Failed to load audio for explanation", e);
        elements.teleprompterSubtitles.textContent = narration + " (Áudio indisponível)";
        state.audioLoading = false;
    }
}

export function returnToLesson() {
    state.explanationActive = false;
    if (elements.btnReturnLesson) elements.btnReturnLesson.style.display = 'none';
    
    // Reload original slide
    loadSlide(state.currentSlideIdx);
}

function composeThumbnailWithTitle(imgSrc, title) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const W = 1280, H = 720;
            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0, W, H);

            const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(0.4, 'rgba(0,0,0,0.7)');
            grad.addColorStop(1, 'rgba(0,0,0,0.93)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            const maxWidth = W - 80;
            const lineHeight = 84;
            let fontSize = 74;
            ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
            while (ctx.measureText(title).width > maxWidth && fontSize > 38) {
                fontSize -= 2;
                ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
            }

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

            ctx.shadowColor = 'rgba(0,0,0,0.98)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 4;

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = fontSize < 50 ? 6 : 9;
            ctx.lineJoin = 'round';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

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
