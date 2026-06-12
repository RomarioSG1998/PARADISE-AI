// classroom/ask.js — "Ask the Teacher" question handler
import { state } from './state.js';
import { elements } from './elements.js';
import { classTranslations } from './translations.js';
import { loadSlide, loadExplanation, stopSubtitleLoop } from './player.js';

/**
 * Sends the student's question to the teacher API and renders the explanation.
 */
export async function handleAskQuestion() {
    const question = elements.askTeacherInput.value.trim();
    const currentLang = localStorage.getItem('paradise_language') || 'pt';
    const t = classTranslations[currentLang] || classTranslations.pt;

    if (!question) {
        alert(t.askEmptyError);
        return;
    }

    // Pause current narration
    elements.audioEl.pause();
    elements.audioEl.src = '';
    elements.teacherAvatar.classList.remove('speaking');
    window.isSpeaking3D = false;
    state.isPlaying = false;
    stopSubtitleLoop();
    elements.playIcon.className = 'fa-solid fa-play';

    elements.askTeacherInput.disabled = true;
    elements.btnAskTeacher.disabled = true;

    // Show loading state on board
    elements.boardSlideTitle.textContent = question;
    elements.boardBullets.innerHTML = `<li><span style="display:inline-block; width:1.2rem; height:1.2rem; border-radius:50%; border:2px solid rgba(255,255,255,0.2); border-top-color:#a78bfa; animation:spin 1s linear infinite; vertical-align:middle; margin-right:8px;"></span> ${t.askingTeacher}</li>`;
    elements.boardImage.className = 'loading';
    elements.downloadBoardBtn.style.display = 'none';

    try {
        const currentSlide = state.lessonData.slides[state.currentSlideIdx];
        const response = await fetch('/api/classroom/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: state.lessonData.subject,
                slide_title: currentSlide.title,
                slide_narration: currentSlide.narration,
                question,
                language: currentLang,
                style: state.lessonData.style || 'classic'
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Erro ao consultar o professor.");
        }

        const explanation = await response.json();
        loadExplanation(explanation);
        elements.askTeacherInput.value = '';
    } catch (err) {
        alert(err.message);
        loadSlide(state.currentSlideIdx);
    } finally {
        elements.askTeacherInput.disabled = false;
        elements.btnAskTeacher.disabled = false;
    }
}

/**
 * Binds the Ask Teacher button and input Enter key.
 */
export function setupAskTeacher() {
    if (elements.btnAskTeacher) {
        elements.btnAskTeacher.addEventListener('click', handleAskQuestion);
    }
    if (elements.askTeacherInput) {
        elements.askTeacherInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAskQuestion();
        });
    }
}
