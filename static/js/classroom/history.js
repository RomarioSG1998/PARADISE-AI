import { state } from './state.js';
import { elements } from './elements.js';
import { classTranslations } from './translations.js';
import { renderLesson } from './player.js';

export function getSavedLessons() {
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

export function saveLessonToHistory(lesson) {
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

export function deleteLessonFromHistory(lessonId, event) {
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

export function loadLessonFromHistory(lessonId) {
    const lessons = getSavedLessons();
    const lesson = lessons.find(l => l.id === lessonId);
    if (lesson) {
        state.lessonData = lesson;
        state.currentSlideIdx = 0;
        elements.setupPanel.style.display = 'none';
        elements.stagePanel.style.display = 'flex';
        
        // Hide reservoir sidebar
        if (elements.reservoirSidebar) {
            elements.reservoirSidebar.classList.remove('active');
            elements.reservoirOverlay.classList.remove('active');
        }
        
        renderLesson();
    }
}

export function renderHistoryList() {
    const reservoirList = elements.reservoirList;
    if (!reservoirList) return;
    
    const lessons = getSavedLessons();
    const lang = localStorage.getItem('paradise_language') || 'pt';
    const t = classTranslations[lang] || classTranslations.pt;
    const slideCountText = t.slideCountText || "slides";
    const themeLabel = t.themeText || "Tema";
    
    if (lessons.length === 0) {
        reservoirList.innerHTML = `
            <div class="reservoir-empty">
                <i class="fa-solid fa-folder-open"></i>
                <p>${t.reservoirEmpty || "Nenhuma aula produzida ainda. Crie uma aula para começar!"}</p>
            </div>
        `;
        return;
    }
    
    reservoirList.innerHTML = '';
    
    lessons.forEach(lesson => {
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
        
        reservoirList.appendChild(card);
    });
}
