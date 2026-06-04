        const modal = document.getElementById('config-modal');
        const statusDot = document.getElementById('status-dot');
        const statusLabel = document.getElementById('status-label');

        document.getElementById('open-config-btn').onclick = () => {
            document.getElementById('config-error').style.display = 'none';
            modal.style.display = 'flex';
        };

        function closeModal() {
            modal.style.display = 'none';
            document.getElementById('cookie-psid').value = '';
            document.getElementById('cookie-psidts').value = '';
        }

        async function checkConnection() {
            try {
                const resp = await fetch('/api/status');
                const data = await resp.json();
                
                if (data.configured && data.active) {
                    statusDot.className = 'dot active';
                    statusLabel.textContent = 'Conectado';
                } else if (data.configured) {
                    statusDot.className = 'dot';
                    statusDot.style.backgroundColor = '#f59e0b';
                    statusLabel.textContent = 'Conexão inativa (Cookies expirados)';
                } else {
                    statusDot.className = 'dot';
                    statusDot.style.backgroundColor = '#ef4444';
                    statusLabel.textContent = 'Desconectado (Sem cookies)';
                }
            } catch (e) {
                statusDot.className = 'dot';
                statusLabel.textContent = 'Erro ao checar status';
            }
        }

        document.getElementById('btn-save-cookies').onclick = async () => {
            const psid = document.getElementById('cookie-psid').value.trim();
            const psidts = document.getElementById('cookie-psidts').value.trim();
            const errDiv = document.getElementById('config-error');

            if (!psid || !psidts) {
                errDiv.textContent = 'Ambos os cookies são obrigatórios!';
                errDiv.style.display = 'block';
                return;
            }

            document.getElementById('btn-save-cookies').disabled = true;
            document.getElementById('btn-save-cookies').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testando Conexão...';

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
                    errDiv.textContent = data.error || 'Erro ao validar conexão.';
                    errDiv.style.display = 'block';
                }
            } catch (e) {
                errDiv.textContent = 'Erro de comunicação com o servidor.';
                errDiv.style.display = 'block';
            } finally {
                document.getElementById('btn-save-cookies').disabled = false;
                document.getElementById('btn-save-cookies').innerHTML = '<i class="fa-solid fa-circle-check"></i> Validar e Salvar Conexão';
            }
        };

        function switchTab(element, tabId) {
            // Remove active class from buttons
            document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            element.classList.add('active');
            
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            // Show active tab content
            document.getElementById(tabId).classList.add('active');
        }

        // Global Language Selection & UI Translation System
        const hubTranslations = {
            pt: {
                greeting: "Olá",
                subtitle: "Selecione um aplicativo abaixo para interagir. Todas as ferramentas utilizam a conexão Pro ilimitada e gratuita do hub.",
                tabApps: "<i class='fa-solid fa-cubes'></i> Meus Aplicativos",
                tabTutorial: "<i class='fa-solid fa-circle-question'></i> Como Funciona & Tutorial de Cookies",
                configBtn: "<i class='fa-solid fa-cookie-bite'></i> Configurar Conexão",
                bookTitle: "Gerador de Livros Pro",
                bookDesc: "Crie livros personalizados com texto, ilustrações geradas por IA e leitura narrada em tempo real com tradutor integrado.",
                classTitle: "Aula Inteligente (AI Classroom)",
                classDesc: "Insira um tema, texto ou PDF e gere uma aula completa com explicação falada por avatar de IA e ilustrações desenhadas em quadro negro.",
                connectionChecking: "Verificando...",
                connectionOnline: "Conexão Pro Ativa",
                connectionOffline: "Sem Conexão Pro",
                modalTitle: "Configurar Cookies da Sessão Pro",
                modalSaveBtn: "<i class='fa-solid fa-circle-check'></i> Validar e Salvar Conexão"
            },
            en: {
                greeting: "Hello",
                subtitle: "Select an application below to interact. All tools use the hub's unlimited and free Pro connection.",
                tabApps: "<i class='fa-solid fa-cubes'></i> My Applications",
                tabTutorial: "<i class='fa-solid fa-circle-question'></i> How it Works & Cookies Tutorial",
                configBtn: "<i class='fa-solid fa-cookie-bite'></i> Configure Connection",
                bookTitle: "Book Generator Pro",
                bookDesc: "Create custom books with text, AI-generated illustrations and real-time narrated reading with integrated translator.",
                classTitle: "Smart Classroom (AI Classroom)",
                classDesc: "Enter a theme, text or PDF and generate a complete class with a spoken explanation by an AI avatar and illustrations drawn on a blackboard.",
                connectionChecking: "Checking...",
                connectionOnline: "Active Pro Connection",
                connectionOffline: "No Pro Connection",
                modalTitle: "Configure Pro Session Cookies",
                modalSaveBtn: "<i class='fa-solid fa-circle-check'></i> Validate and Save Connection"
            },
            es: {
                greeting: "Hola",
                subtitle: "Seleccione una aplicación a continuación para interactuar. Todas las herramientas utilizan la conexión Pro ilimitada y gratuita del hub.",
                tabApps: "<i class='fa-solid fa-cubes'></i> Mis Aplicaciones",
                tabTutorial: "<i class='fa-solid fa-circle-question'></i> Cómo Funciona y Tutorial de Cookies",
                configBtn: "<i class='fa-solid fa-cookie-bite'></i> Configurar Conexión",
                bookTitle: "Generador de Livros Pro",
                bookDesc: "Cree libros personalizados con texto, ilustraciones generadas por IA y lectura narrada en tempo real con traductor integrado.",
                classTitle: "Aula Inteligente (AI Classroom)",
                classDesc: "Ingrese un tema, texto o PDF y genere una clase completa con explicación hablada por avatar de IA e ilustraciones dibujadas en pizarra.",
                connectionChecking: "Verificando...",
                connectionOnline: "Conexión Pro Activa",
                connectionOffline: "Sin Conexión Pro",
                modalTitle: "Configurar Cookies de Sesión Pro",
                modalSaveBtn: "<i class='fa-solid fa-circle-check'></i> Validar y Guardar Conexión"
            }
        };

        function applyLanguage(lang) {
            localStorage.setItem("paradise_language", lang);
            document.cookie = `paradise_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
            
            const t = hubTranslations[lang] || hubTranslations.pt;
            
            // Greeting
            const greetingHeader = document.querySelector('.welcome-text h1');
            const username = document.getElementById('user-greeting-name')?.textContent || 'Usuário';
            if (greetingHeader) {
                greetingHeader.innerHTML = `${t.greeting}, <span id="user-greeting-name">${username}</span>!`;
            }
            const subtitle = document.querySelector('.welcome-text p');
            if (subtitle) subtitle.textContent = t.subtitle;
            
            // Tabs
            const tabLinks = document.querySelectorAll('.tab-link');
            if (tabLinks.length >= 2) {
                tabLinks[0].innerHTML = t.tabApps;
                tabLinks[1].innerHTML = t.tabTutorial;
            }
            
            // Config Button
            const configBtn = document.getElementById('open-config-btn');
            if (configBtn) configBtn.innerHTML = t.configBtn;
            
            // App Cards
            const appNames = document.querySelectorAll('.app-name');
            const appDescs = document.querySelectorAll('.app-desc');
            if (appNames.length >= 2) {
                appNames[0].textContent = t.bookTitle;
                appDescs[0].textContent = t.bookDesc;
                
                appNames[1].textContent = t.classTitle;
                appDescs[1].textContent = t.classDesc;
            }
            
            // Connection Status Label
            const statusLabel = document.getElementById('status-label');
            if (statusLabel) {
                if (statusLabel.textContent === 'Verificando...' || statusLabel.textContent === 'Checking...') {
                    statusLabel.textContent = t.connectionChecking;
                } else if (statusLabel.textContent.includes('Ativa') || statusLabel.textContent.includes('Active')) {
                    statusLabel.textContent = t.connectionOnline;
                } else {
                    statusLabel.textContent = t.connectionOffline;
                }
            }
            
            // Modal Title
            const modalTitle = document.querySelector('.modal-title');
            if (modalTitle) modalTitle.textContent = t.modalTitle;
            
            const saveBtn = document.getElementById('btn-save-cookies');
            if (saveBtn && !saveBtn.disabled) saveBtn.innerHTML = t.modalSaveBtn;
            
            // Sync the selector dropdown
            const langSelect = document.getElementById('global-lang-select');
            if (langSelect) langSelect.value = lang;
        }

        document.getElementById('global-lang-select').addEventListener('change', (e) => {
            applyLanguage(e.target.value);
        });

        window.onload = () => {
            checkConnection();
            const currentLang = localStorage.getItem('paradise_language') || 'pt';
            applyLanguage(currentLang);
        };
