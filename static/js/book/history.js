import { state } from './state.js';
import { elements } from './elements.js';
import { renderChapter } from './player.js';
import { applyVisualTheme } from './main.js';

export function getSavedBooks() {
    const data = localStorage.getItem('paradise_books');
    if (data) {
        try {
            return JSON.parse(data) || [];
        } catch(e) {
            return [];
        }
    }
    return [];
}

export function saveBookToHistory(book) {
    let books = getSavedBooks();
    if (!book.id) {
        book.id = Date.now();
    }
    const idx = books.findIndex(b => b.id === book.id);
    if (idx !== -1) {
        books[idx] = book;
    } else {
        books.unshift(book);
    }
    if (books.length > 10) {
        books = books.slice(0, 10);
    }
    localStorage.setItem('paradise_books', JSON.stringify(books));
    renderHistoryList();
}

export function deleteBookFromHistory(bookId, event) {
    if (event) event.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir este livro do seu histórico?")) return;
    let books = getSavedBooks();
    books = books.filter(b => b.id !== bookId);
    localStorage.setItem('paradise_books', JSON.stringify(books));
    renderHistoryList();
}

export function loadBookFromHistory(bookId) {
    const books = getSavedBooks();
    const book = books.find(b => b.id === bookId);
    if (book) {
        state.currentBook = book;
        state.currentChapterIndex = 0;
        elements.panelForm.style.display = 'none';
        elements.panelReader.style.display = 'flex';
        applyVisualTheme(book.visual_theme || 'cartoon');
        renderChapter();
    }
}

export function renderHistoryList() {
    const historyPanel = document.getElementById('history-panel');
    const historyList = document.getElementById('history-list');
    if (!historyPanel || !historyList) return;
    const books = getSavedBooks();
    
    if (books.length === 0) {
        historyPanel.style.display = 'none';
        return;
    }
    
    historyPanel.style.display = 'block';
    historyList.innerHTML = '';
    
    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'cartoon-panel';
        card.style.padding = '1.5rem';
        card.style.background = '#0f172a';
        card.style.border = '3px solid var(--border-cartoon)';
        card.style.borderRadius = '18px';
        card.style.boxShadow = '5px 5px 0px var(--border-cartoon)';
        card.style.cursor = 'pointer';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.75rem';
        card.style.transition = 'all 0.15s ease-in-out';
        
        card.onmouseenter = () => {
            card.style.transform = 'translate(-2px, -2px)';
            card.style.boxShadow = '7px 7px 0px var(--border-cartoon)';
        };
        card.onmouseleave = () => {
            card.style.transform = 'none';
            card.style.boxShadow = '5px 5px 0px var(--border-cartoon)';
        };
        
        card.onclick = () => loadBookFromHistory(book.id);
        
        const title = document.createElement('h4');
        title.style.fontSize = '1.05rem';
        title.style.fontWeight = '800';
        title.style.color = 'white';
        title.style.margin = '0';
        title.style.lineHeight = '1.3';
        title.textContent = book.theme;
        
        const meta = document.createElement('div');
        meta.style.fontSize = '0.8rem';
        meta.style.fontWeight = '700';
        meta.style.color = '#94a3b8';
        meta.innerHTML = `<span style="color: var(--accent-yellow);">${book.level}</span> · <span>${book.language}</span>`;
        
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';
        footer.style.alignItems = 'center';
        footer.style.marginTop = '0.5rem';
        
        const pageCount = document.createElement('span');
        pageCount.style.fontSize = '0.75rem';
        pageCount.style.color = '#64748b';
        pageCount.textContent = `${book.chapters ? book.chapters.length : 0} páginas`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn pink';
        deleteBtn.style.padding = '0.35rem 0.65rem';
        deleteBtn.style.fontSize = '0.8rem';
        deleteBtn.style.boxShadow = '2px 2px 0px var(--border-cartoon)';
        deleteBtn.style.borderWidth = '2px';
        deleteBtn.style.borderRadius = '8px';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.title = "Excluir Livro";
        deleteBtn.onclick = (e) => deleteBookFromHistory(book.id, e);
        
        footer.appendChild(pageCount);
        footer.appendChild(deleteBtn);
        
        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(footer);
        
        historyList.appendChild(card);
    });
}
