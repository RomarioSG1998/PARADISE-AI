import { elements } from './elements.js';
import { hubTranslations } from './translations.js';

export function closeModal() {
    if (elements.modal) {
        elements.modal.style.display = 'none';
    }
    if (elements.cookiePsid) elements.cookiePsid.value = '';
    if (elements.cookiePsidts) elements.cookiePsidts.value = '';
}

export async function checkConnection() {
    if (!elements.statusDot || !elements.statusLabel) return;
    try {
        const resp = await fetch('/api/status');
        const data = await resp.json();
        
        if (data.configured && data.active) {
            elements.statusDot.className = 'dot active';
            elements.statusDot.style.backgroundColor = '';
            elements.statusLabel.textContent = 'Conectado';
        } else if (data.configured) {
            elements.statusDot.className = 'dot';
            elements.statusDot.style.backgroundColor = '#f59e0b';
            elements.statusLabel.textContent = 'Conexão inativa (Cookies expirados)';
        } else {
            elements.statusDot.className = 'dot';
            elements.statusDot.style.backgroundColor = '#ef4444';
            elements.statusLabel.textContent = 'Desconectado (Sem cookies)';
        }
    } catch (e) {
        elements.statusDot.className = 'dot';
        elements.statusDot.style.backgroundColor = '#ef4444';
        elements.statusLabel.textContent = 'Erro ao checar status';
    }
}

export function switchTab(element, tabId) {
    document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

export function applyLanguage(lang) {
    localStorage.setItem("paradise_language", lang);
    document.cookie = `paradise_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    
    const t = hubTranslations[lang] || hubTranslations.pt;
    
    const greetingHeader = document.querySelector('.welcome-text h1');
    const username = document.getElementById('user-greeting-name')?.textContent || 'Usuário';
    if (greetingHeader) {
        greetingHeader.innerHTML = `${t.greeting}, <span id="user-greeting-name">${username}</span>!`;
    }
    
    const subtitle = document.querySelector('.welcome-text p');
    if (subtitle) subtitle.textContent = t.subtitle;
    
    const tabLinks = document.querySelectorAll('.tab-link');
    if (tabLinks.length >= 2) {
        tabLinks[0].innerHTML = t.tabApps;
        tabLinks[1].innerHTML = t.tabTutorial;
    }
    
    if (elements.openConfigBtn) elements.openConfigBtn.innerHTML = t.configBtn;
    
    const appNames = document.querySelectorAll('.app-name');
    const appDescs = document.querySelectorAll('.app-desc');
    if (appNames.length >= 2) {
        appNames[0].textContent = t.bookTitle;
        appDescs[0].textContent = t.bookDesc;
        
        appNames[1].textContent = t.classTitle;
        appDescs[1].textContent = t.classDesc;
    }
    
    if (elements.statusLabel) {
        if (elements.statusLabel.textContent === 'Verificando...' || elements.statusLabel.textContent === 'Checking...') {
            elements.statusLabel.textContent = t.connectionChecking;
        } else if (elements.statusLabel.textContent.includes('Ativa') || elements.statusLabel.textContent.includes('Active')) {
            elements.statusLabel.textContent = t.connectionOnline;
        } else {
            elements.statusLabel.textContent = t.connectionOffline;
        }
    }
    
    const modalTitle = document.querySelector('.modal-title');
    if (modalTitle) modalTitle.textContent = t.modalTitle;
    
    if (elements.btnSaveCookies && !elements.btnSaveCookies.disabled) {
        elements.btnSaveCookies.innerHTML = t.modalSaveBtn;
    }
    
    if (elements.globalLangSelect) elements.globalLangSelect.value = lang;
}

// Setup Event Listeners
function setupEvents() {
    if (elements.openConfigBtn) {
        elements.openConfigBtn.onclick = () => {
            if (elements.configError) elements.configError.style.display = 'none';
            if (elements.modal) elements.modal.style.display = 'flex';
        };
    }

    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) {
        closeBtn.onclick = closeModal;
    }

    if (elements.btnSaveCookies) {
        elements.btnSaveCookies.onclick = async () => {
            const psid = elements.cookiePsid.value.trim();
            const psidts = elements.cookiePsidts.value.trim();

            if (!psid || !psidts) {
                if (elements.configError) {
                    elements.configError.textContent = 'Ambos os cookies são obrigatórios!';
                    elements.configError.style.display = 'block';
                }
                return;
            }

            elements.btnSaveCookies.disabled = true;
            elements.btnSaveCookies.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testando Conexão...';

            try {
                const resp = await fetch('/api/save-cookies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ secure_1psid: psid, secure_1psidts: psidts })
                });
                
                const data = await resp.json();
                if (data.success) {
                    closeModal();
                    checkConnection();
                } else {
                    if (elements.configError) {
                        elements.configError.textContent = data.error || 'Erro ao validar conexão.';
                        elements.configError.style.display = 'block';
                    }
                }
            } catch (e) {
                if (elements.configError) {
                    elements.configError.textContent = 'Erro de comunicação com o servidor.';
                    elements.configError.style.display = 'block';
                }
            } finally {
                elements.btnSaveCookies.disabled = false;
                const currentLang = localStorage.getItem('paradise_language') || 'pt';
                const t = hubTranslations[currentLang] || hubTranslations.pt;
                elements.btnSaveCookies.innerHTML = t.modalSaveBtn;
            }
        };
    }

    // Attach switchTab to tab links dynamically
    document.querySelectorAll('.tab-link').forEach((link, idx) => {
        link.onclick = (e) => {
            const tabId = idx === 0 ? 'apps-content' : 'tutorial-content';
            switchTab(e.currentTarget, tabId);
        };
    });

    if (elements.globalLangSelect) {
        elements.globalLangSelect.addEventListener('change', (e) => {
            applyLanguage(e.target.value);
        });
    }
}

// Initial Boot Loader
document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    checkConnection();
    const currentLang = localStorage.getItem('paradise_language') || 'pt';
    applyLanguage(currentLang);
});
