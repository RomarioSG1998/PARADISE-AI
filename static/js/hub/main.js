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

export async function loadProfile() {
    try {
        const resp = await fetch('/api/profile');
        if (!resp.ok) return;
        const data = await resp.json();
        
        if (elements.profileFullname) elements.profileFullname.value = data.full_name || '';
        if (elements.profileEmail) elements.profileEmail.value = data.email || '';
        if (elements.profileLang) elements.profileLang.value = data.language || 'pt';
        if (elements.profileAvatarName) elements.profileAvatarName.value = data.avatar_name || 'Professor';
        if (elements.profileAvatarUrl) elements.profileAvatarUrl.value = data.avatar_image_url || '';
        
        if (elements.profileAvatarPreview) {
            elements.profileAvatarPreview.src = data.avatar_image_url || '/static/images/walle.png';
        }
        
        const userGreetingName = document.getElementById('user-greeting-name');
        if (userGreetingName) {
            userGreetingName.textContent = data.full_name || data.username;
        }
        
        // Auto-apply the user's saved language preference if it exists
        if (data.language && data.language !== localStorage.getItem("paradise_language")) {
            applyLanguage(data.language);
        }
    } catch (e) {
        console.error("Failed to load user profile:", e);
    }
}

export async function saveProfile() {
    if (elements.profileError) elements.profileError.style.display = 'none';
    if (elements.profileSuccess) elements.profileSuccess.style.display = 'none';
    
    const fullname = elements.profileFullname.value.trim();
    const email = elements.profileEmail.value.trim();
    const lang = elements.profileLang.value;
    const avatarName = elements.profileAvatarName.value.trim();
    const avatarUrl = elements.profileAvatarUrl.value.trim();
    
    if (elements.btnSaveProfile) {
        elements.btnSaveProfile.disabled = true;
        elements.btnSaveProfile.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    }
    
    try {
        const resp = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: fullname,
                email: email,
                language: lang,
                avatar_name: avatarName,
                avatar_image_url: avatarUrl
            })
        });
        
        const data = await resp.json();
        if (resp.ok) {
            if (elements.profileSuccess) elements.profileSuccess.style.display = 'block';
            await loadProfile();
            setTimeout(() => {
                if (elements.profileModal) elements.profileModal.style.display = 'none';
                if (elements.profileSuccess) elements.profileSuccess.style.display = 'none';
            }, 1000);
        } else {
            if (elements.profileError) {
                elements.profileError.textContent = data.error || 'Erro ao salvar perfil.';
                elements.profileError.style.display = 'block';
            }
        }
    } catch (e) {
        if (elements.profileError) {
            elements.profileError.textContent = 'Erro ao se conectar com o servidor.';
            elements.profileError.style.display = 'block';
        }
    } finally {
        if (elements.btnSaveProfile) {
            elements.btnSaveProfile.disabled = false;
            elements.btnSaveProfile.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Perfil';
        }
    }
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
            const providerEl = document.getElementById('cookie-provider');
            const provider = providerEl ? providerEl.value : 'gemini';
            const psid = elements.cookiePsid.value.trim();
            const psidts = elements.cookiePsidts.value.trim();

            if (provider === 'gemini' && (!psid || !psidts)) {
                if (elements.configError) {
                    elements.configError.textContent = 'Ambos os cookies são obrigatórios para o Gemini!';
                    elements.configError.style.display = 'block';
                }
                return;
            } else if (provider === 'copilot' && !psid) {
                if (elements.configError) {
                    elements.configError.textContent = 'O cookie _U é obrigatório para o Copilot!';
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
                    body: JSON.stringify({ provider: provider, secure_1psid: psid, secure_1psidts: psidts })
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

    // Profile events
    if (elements.openProfileBtn) {
        elements.openProfileBtn.onclick = () => {
            if (elements.profileError) elements.profileError.style.display = 'none';
            if (elements.profileSuccess) elements.profileSuccess.style.display = 'none';
            if (elements.profileModal) elements.profileModal.style.display = 'flex';
            loadProfile();
        };
    }

    if (elements.closeProfileBtn) {
        elements.closeProfileBtn.onclick = () => {
            if (elements.profileModal) elements.profileModal.style.display = 'none';
        };
    }

    if (elements.btnSaveProfile) {
        elements.btnSaveProfile.onclick = saveProfile;
    }

    if (elements.profileAvatarFile) {
        elements.profileAvatarFile.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (elements.profileAvatarPreview) elements.profileAvatarPreview.src = event.target.result;
                    if (elements.profileAvatarUrl) elements.profileAvatarUrl.value = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    if (elements.profileAvatarUrl) {
        elements.profileAvatarUrl.oninput = (e) => {
            if (elements.profileAvatarPreview) {
                elements.profileAvatarPreview.src = e.target.value || '/static/images/walle.png';
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
            const lang = e.target.value;
            const fullname = elements.profileFullname ? elements.profileFullname.value.trim() : '';
            if (fullname) {
                const email = elements.profileEmail ? elements.profileEmail.value.trim() : '';
                const avatarName = elements.profileAvatarName ? elements.profileAvatarName.value.trim() : '';
                const avatarUrl = elements.profileAvatarUrl ? elements.profileAvatarUrl.value.trim() : '';
                fetch('/api/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        full_name: fullname,
                        email: email,
                        language: lang,
                        avatar_name: avatarName,
                        avatar_image_url: avatarUrl
                    })
                });
            }
        });
    }

    const providerSelect = document.getElementById('cookie-provider');
    if (providerSelect) {
        providerSelect.addEventListener('change', (e) => {
            const provider = e.target.value;
            const psidtsGrp = document.getElementById('psidts-group');
            const lblPsid = document.getElementById('lbl-cookie-psid');
            const lblPsidts = document.getElementById('lbl-cookie-psidts');
            const inPsid = document.getElementById('cookie-psid');
            const inPsidts = document.getElementById('cookie-psidts');
            
            if (provider === 'gemini') {
                lblPsid.innerText = 'Cookie __Secure-1PSID';
                inPsid.placeholder = 'Cole o valor do cookie __Secure-1PSID';
                if(psidtsGrp) psidtsGrp.style.display = 'block';
                if(lblPsidts) lblPsidts.innerText = 'Cookie __Secure-1PSIDTS';
                if(inPsidts) inPsidts.placeholder = 'Cole o valor do cookie __Secure-1PSIDTS';
            } else if (provider === 'copilot') {
                lblPsid.innerText = 'Cookie _U da Microsoft';
                inPsid.placeholder = 'Cole o valor do cookie _U de bing.com/chat';
                if(psidtsGrp) psidtsGrp.style.display = 'none';
            } else if (provider === 'gpt') {
                lblPsid.innerText = 'Token de Acesso (Opcional)';
                inPsid.placeholder = 'Geralmente opcional para g4f. Deixe em branco.';
                if(psidtsGrp) psidtsGrp.style.display = 'none';
            }
        });
    }
}

// Initial Boot Loader
document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    checkConnection();
    loadProfile();
    const currentLang = localStorage.getItem('paradise_language') || 'pt';
    applyLanguage(currentLang);
});

