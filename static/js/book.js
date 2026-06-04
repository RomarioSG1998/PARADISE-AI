        // DOM Elements
        const panelForm = document.getElementById('panel-form');
        const panelLoader = document.getElementById('panel-loader');
        const panelReader = document.getElementById('panel-reader');
        const btnGenerate = document.getElementById('btn-generate-book');
        const physicalBook = document.getElementById('physical-book');
        const bookScrollBody = document.getElementById('book-scroll-body');

        const stepWrite = document.getElementById('step-write');
        const stepImg1 = document.getElementById('step-img1');
        const stepImg2 = document.getElementById('step-img2');
        const stepImg3 = document.getElementById('step-img3');

        const iconWrite = document.getElementById('icon-write');
        const iconImg1 = document.getElementById('icon-img1');
        const iconImg2 = document.getElementById('icon-img2');
        const iconImg3 = document.getElementById('icon-img3');

        const readMetaInfo = document.getElementById('book-meta-info');
        const readPageCounter = document.getElementById('page-counter');
        const readChapterTitle = document.getElementById('read-chapter-title');
        const readChapterText = document.getElementById('read-chapter-text');
        const readIllustrationImg = document.getElementById('illustration-img');

        const btnPrevPage = document.getElementById('btn-prev-page');
        const btnNextPage = document.getElementById('btn-next-page');
        const btnNewBook = document.getElementById('btn-new-book');
        const btnReillustrate = document.getElementById('btn-reillustrate');

        const audioPlay = document.getElementById('audio-play');
        const audioStop = document.getElementById('audio-stop');
        const btnAutoPlay = document.getElementById('btn-auto-play');
        const autoPlayIcon = document.getElementById('auto-play-icon');
        const speechRate = document.getElementById('speech-rate');

        const modalRedraw = document.getElementById('modal-redraw');
        const redrawPromptInput = document.getElementById('redraw-prompt');
        const redrawLoading = document.getElementById('redraw-loading');
        const btnSubmitRedraw = document.getElementById('btn-submit-redraw');

        const translationBubble = document.getElementById('translation-bubble');

        // State Variables
        let currentBook = null;
        let currentChapterIndex = 0;
        let autoPlayEnabled = localStorage.getItem('book_autoplay') !== 'false';
        
        // Voice State Variables
        let activeParagraphElement = null;
        let speakingParagraphsQueue = [];
        let currentSpeakingQueueIndex = 0;

        function getProxyUrl(url) {
            if (url && (url.includes("googleusercontent.com") || url.includes("google.com"))) {
                return `/api/proxy-image?url=${encodeURIComponent(url)}`;
            }
            return url;
        }

        function updateLoaderStep(stepId, status) {
            const item = document.getElementById(`step-${stepId}`);
            const icon = document.getElementById(`icon-${stepId}`);

            if (status === 'active') {
                item.className = 'step-item active';
                icon.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            } else if (status === 'done') {
                item.className = 'step-item done';
                icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            } else {
                item.className = 'step-item';
                icon.innerHTML = '<i class="fa-solid fa-circle"></i>';
            }
        }

        // Generate Book Event
        btnGenerate.onclick = async () => {
            const theme = document.getElementById('book-theme').value.trim();
            const level = document.getElementById('book-level').value;
            const lang = document.getElementById('book-lang').value;

            if (!theme) {
                alert("Por favor, digite uma ideia ou enredo de aventura!");
                return;
            }

            panelForm.style.display = 'none';
            panelLoader.style.display = 'flex';

            updateLoaderStep('write', 'active');
            updateLoaderStep('img1', 'pending');
            updateLoaderStep('img2', 'pending');
            updateLoaderStep('img3', 'pending');

            let timer1 = setTimeout(() => {
                updateLoaderStep('write', 'done');
                updateLoaderStep('img1', 'active');
            }, 9000);

            let timer2 = setTimeout(() => {
                updateLoaderStep('img1', 'done');
                updateLoaderStep('img2', 'active');
            }, 15000);

            let timer3 = setTimeout(() => {
                updateLoaderStep('img2', 'done');
                updateLoaderStep('img3', 'active');
            }, 21000);

            try {
                const resp = await fetch('/api/book/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ theme, level, language: lang })
                });

                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);

                if (!resp.ok) throw new Error("Erro na geração do livro.");
                const data = await resp.json();
                
                updateLoaderStep('write', 'done');
                updateLoaderStep('img1', 'done');
                updateLoaderStep('img2', 'done');
                updateLoaderStep('img3', 'done');

                currentBook = data;
                currentBook.id = Date.now();
                saveBookToHistory(currentBook);
                currentChapterIndex = 0;
                
                setTimeout(() => {
                    panelLoader.style.display = 'none';
                    panelReader.style.display = 'flex';
                    renderChapter();
                }, 1000);

            } catch (e) {
                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);
                alert("Falha na geração do livro: " + e.message);
                panelLoader.style.display = 'none';
                panelForm.style.display = 'block';
            }
        };

        // Split text into individual words wrapped in spans with character indices
        function prepareTextForHighlighting(text) {
            let html = "";
            let currentOffset = 0;
            
            const tokens = text.split(/(\s+)/);
            tokens.forEach(token => {
                if (token.trim() === '') {
                    html += token;
                    currentOffset += token.length;
                } else {
                    html += `<span class="word-span" data-start="${currentOffset}" data-end="${currentOffset + token.length}">${token}</span>`;
                    currentOffset += token.length;
                }
            });
            return html;
        }

        // Render current chapter
        function renderChapter() {
            if (!currentBook || !currentBook.chapters) return;

            stopNarration();

            const chapter = currentBook.chapters[currentChapterIndex];
            
            readMetaInfo.textContent = `${currentBook.theme} · Nível: ${currentBook.level} · Idioma: ${currentBook.language}`;
            readPageCounter.textContent = `Página ${chapter.chapter_number} de ${currentBook.chapters.length}`;
            readChapterTitle.textContent = chapter.title;

            // Reset text scroll position to top
            bookScrollBody.scrollTop = 0;

            // Dynamic background illustration setting wrapped in double quotes
            if (chapter.image_url) {
                const proxyBg = getProxyUrl(chapter.image_url);
                console.log("[Paradise AI] Setting background image to:", proxyBg);
                bookScrollBody.style.backgroundImage = `url("${proxyBg}")`;
            } else {
                bookScrollBody.style.backgroundImage = 'none';
            }

            readChapterText.innerHTML = '';
            
            const paragraphs = chapter.text.split('\n').filter(p => p.trim() !== '');
            paragraphs.forEach((pText, pIdx) => {
                const p = document.createElement('p');
                p.setAttribute('data-idx', pIdx);
                p.setAttribute('data-raw-text', pText);

                p.innerHTML = prepareTextForHighlighting(pText);

                // Word clicks
                p.querySelectorAll('.word-span').forEach(wordSpan => {
                    wordSpan.onclick = (e) => {
                        e.stopPropagation();
                        const word = wordSpan.textContent.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g,"");
                        if (word.length > 0) {
                            explainWordDetail(word, pText, e.clientX, e.clientY);
                        }
                    };
                });

                // Paragraph tools
                const tools = document.createElement('span');
                tools.className = 'paragraph-tools';
                
                const playBtn = document.createElement('button');
                playBtn.className = 'tool-btn';
                playBtn.title = "Ouvir este parágrafo";
                playBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                playBtn.onclick = (e) => {
                    e.stopPropagation();
                    speakParagraph(p);
                };

                tools.appendChild(playBtn);
                p.appendChild(tools);

                readChapterText.appendChild(p);
            });

            // Set Illustration (containment)
            readIllustrationImg.className = 'loading';
            const dlBtn = document.getElementById('btn-download-illustration');
            if (chapter.image_url) {
                const imgUrl = getProxyUrl(chapter.image_url);
                console.log("[Paradise AI] Setting frame image src to:", imgUrl);
                readIllustrationImg.src = imgUrl;
                readIllustrationImg.style.display = 'block';
                readIllustrationImg.style.cursor = 'pointer';
                readIllustrationImg.onclick = () => window.open(chapter.image_url || imgUrl, '_blank');
                
                dlBtn.href = imgUrl;
                dlBtn.style.display = 'flex';
                
                document.getElementById('illustration-error').style.display = 'none';
                readIllustrationImg.onload = () => readIllustrationImg.className = '';
            } else {
                readIllustrationImg.src = '';
                readIllustrationImg.alt = 'Sem desenho';
                readIllustrationImg.className = '';
                readIllustrationImg.style.display = 'none';
                dlBtn.style.display = 'none';
                document.getElementById('illustration-error').style.display = 'flex';
                if (chapter.image_error) {
                    document.getElementById('illustration-error-msg').textContent = chapter.image_error;
                } else {
                    document.getElementById('illustration-error-msg').textContent = 'Nenhuma imagem foi gerada pelo Gemini para este capítulo.';
                }
            }

            // Navigation buttons
            btnPrevPage.disabled = currentChapterIndex === 0;
            if (currentChapterIndex === currentBook.chapters.length - 1) {
                btnNextPage.innerHTML = 'Fim <i class="fa-solid fa-flag-checkered"></i>';
            } else {
                btnNextPage.innerHTML = 'Próximo <i class="fa-solid fa-arrow-right"></i>';
            }
        }

        // Page Flip Animation
        function triggerPageFlipAnimation(callback) {
            physicalBook.classList.remove('page-flip-animate');
            void physicalBook.offsetWidth;
            physicalBook.classList.add('page-flip-animate');
            
            setTimeout(() => {
                callback();
            }, 250);
            
            setTimeout(() => {
                physicalBook.classList.remove('page-flip-animate');
            }, 500);
        }

        // Navigation
        btnPrevPage.onclick = () => {
            if (currentChapterIndex > 0) {
                triggerPageFlipAnimation(() => {
                    currentChapterIndex--;
                    renderChapter();
                });
            }
        };

        btnNextPage.onclick = () => {
            if (currentChapterIndex < currentBook.chapters.length - 1) {
                triggerPageFlipAnimation(() => {
                    currentChapterIndex++;
                    renderChapter();
                });
            } else {
                alert("Fim da aventura ilustrada! Deseja criar mais histórias?");
            }
        };

        btnNewBook.onclick = () => {
            stopNarration();
            currentBook = null;
            panelReader.style.display = 'none';
            panelForm.style.display = 'block';
            document.getElementById('book-theme').value = '';
        };

        // TTS Speech Control
        function setPlayState(isPlaying) {
            if (isPlaying) {
                audioPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
                audioPlay.title = "Pausar Narração";
            } else {
                audioPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
                audioPlay.title = "Ouvir Capítulo";
            }
        }

        function stopNarration() {
            window.speechSynthesis.cancel();
            setPlayState(false);
            clearHighlights();
            activeParagraphElement = null;
            speakingParagraphsQueue = [];
            currentSpeakingQueueIndex = 0;
        }

        audioPlay.onclick = () => {
            if (window.speechSynthesis.speaking) {
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                    setPlayState(true);
                } else {
                    window.speechSynthesis.pause();
                    setPlayState(false);
                }
            } else {
                const pElements = Array.from(document.querySelectorAll('#read-chapter-text p'));
                if (pElements.length > 0) {
                    speakingParagraphsQueue = pElements;
                    currentSpeakingQueueIndex = 0;
                    speakQueue();
                }
            }
        };

        audioStop.onclick = () => {
            stopNarration();
        };

        btnAutoPlay.onclick = () => {
            autoPlayEnabled = !autoPlayEnabled;
            localStorage.setItem('book_autoplay', autoPlayEnabled);
            updateAutoPlayUI();
        };

        function updateAutoPlayUI() {
            const lang = localStorage.getItem('paradise_language') || 'pt';
            const t = bookTranslations[lang] || bookTranslations.pt;
            if (autoPlayEnabled) {
                btnAutoPlay.title = t.autoPlayActive || "Página Automática: Ativada";
                autoPlayIcon.className = "fa-solid fa-toggle-on";
                btnAutoPlay.style.color = "#f472b6";
                btnAutoPlay.style.borderColor = "rgba(244, 114, 182, 0.6)";
            } else {
                btnAutoPlay.title = t.autoPlayInactive || "Página Automática: Desativada";
                autoPlayIcon.className = "fa-solid fa-toggle-off";
                btnAutoPlay.style.color = "var(--border-cartoon)";
                btnAutoPlay.style.borderColor = "var(--border-cartoon)";
            }
        }

        function speakQueue() {
            if (currentSpeakingQueueIndex >= speakingParagraphsQueue.length) {
                stopNarration();
                
                // Autoplay next page if enabled and has next page
                if (autoPlayEnabled && currentBook && currentChapterIndex < currentBook.chapters.length - 1) {
                    setTimeout(() => {
                        if (autoPlayEnabled && panelReader.style.display === 'flex') {
                            triggerPageFlipAnimation(() => {
                                currentChapterIndex++;
                                renderChapter();
                                setTimeout(() => {
                                    if (panelReader.style.display === 'flex') {
                                        const pElements = Array.from(document.querySelectorAll('#read-chapter-text p'));
                                        if (pElements.length > 0) {
                                            speakingParagraphsQueue = pElements;
                                            currentSpeakingQueueIndex = 0;
                                            speakQueue();
                                        }
                                    }
                                }, 800);
                            });
                        }
                    }, 2000);
                } else if (autoPlayEnabled && currentBook && currentChapterIndex === currentBook.chapters.length - 1) {
                    setTimeout(() => {
                        alert("Fim da aventura ilustrada! Deseja criar mais histórias?");
                    }, 500);
                }
                return;
            }

            const pElement = speakingParagraphsQueue[currentSpeakingQueueIndex];
            speakParagraph(pElement, () => {
                currentSpeakingQueueIndex++;
                speakQueue();
            });
        }

        function speakParagraph(pElement, onFinishedCallback = null) {
            window.speechSynthesis.cancel();
            clearHighlights();

            activeParagraphElement = pElement;
            pElement.classList.add('speaking-highlight');

            const rawText = pElement.getAttribute('data-raw-text');

            let speechLang = 'pt-BR';
            const langLower = (currentBook.language || '').toLowerCase();
            if (langLower.includes('inglês') || langLower.includes('english') || langLower.includes('en')) speechLang = 'en-US';
            else if (langLower.includes('espanhol') || langLower.includes('spanish') || langLower.includes('es') || langLower.includes('español')) speechLang = 'es-ES';
            else if (langLower.includes('francês') || langLower.includes('french') || langLower.includes('fr')) speechLang = 'fr-FR';
            else if (langLower.includes('italiano') || langLower.includes('italian') || langLower.includes('it')) speechLang = 'it-IT';
            else if (langLower.includes('alemão') || langLower.includes('german') || langLower.includes('de')) speechLang = 'de-DE';

            const utterance = new SpeechSynthesisUtterance(rawText);
            utterance.lang = speechLang;
            utterance.rate = parseFloat(speechRate.value) || 1.0;

            // Highlight words
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    const charIndex = event.charIndex;
                    const spans = pElement.querySelectorAll('.word-span');
                    
                    spans.forEach(span => {
                        const start = parseInt(span.getAttribute('data-start'));
                        const end = parseInt(span.getAttribute('data-end'));
                        
                        if (charIndex >= start && charIndex < end) {
                            span.classList.add('word-highlight');
                            span.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        } else {
                            span.classList.remove('word-highlight');
                        }
                    });
                }
            };

            utterance.onend = () => {
                pElement.classList.remove('speaking-highlight');
                pElement.querySelectorAll('.word-span').forEach(span => {
                    span.classList.remove('word-highlight');
                });
                
                if (onFinishedCallback) {
                    onFinishedCallback();
                } else {
                    stopNarration();
                }
            };

            currentUtterance = utterance;
            window.speechSynthesis.speak(utterance);
            setPlayState(true);
        }

        function clearHighlights() {
            document.querySelectorAll('#read-chapter-text p').forEach(p => {
                p.classList.remove('speaking-highlight');
                p.querySelectorAll('.word-span').forEach(span => {
                    span.classList.remove('word-highlight');
                });
            });
        }

        // Float Word Explanation Details + Cartoon Generation
        async function explainWordDetail(word, sentence, x, y) {
            closeTranslationBubble();
            
            let bubbleLeft = x + window.scrollX - 40;
            if (bubbleLeft + 330 > window.innerWidth) {
                bubbleLeft = window.innerWidth - 350;
            }
            if (bubbleLeft < 10) bubbleLeft = 10;

            let bubbleTop = y + window.scrollY - 195;
            if (bubbleTop < 10) bubbleTop = 10;

            translationBubble.style.left = `${bubbleLeft}px`;
            translationBubble.style.top = `${bubbleTop}px`;
            translationBubble.style.display = 'flex';
            
            translationBubble.innerHTML = `
                <div class="translation-bubble-header">
                    <span>Dicionário do Livro</span>
                    <button class="translation-bubble-close" onclick="closeTranslationBubble()">&times;</button>
                </div>
                <div class="word-explorer-content">
                    <div class="word-info">
                        <div style="font-size: 1.15rem; font-weight: 800; color: #1e293b; text-transform: capitalize;">${word}</div>
                        <div id="word-translation" style="margin-top: 0.3rem; font-weight: 700; color: var(--accent-pink); font-size: 0.95rem;">Traduzindo...</div>
                        <div id="word-explanation" style="margin-top: 0.4rem; font-size: 0.82rem; color: #475569; line-height: 1.3;">Buscando significado...</div>
                    </div>
                    <div id="word-illustration-box" class="word-micro-img">
                        <i class="fa-solid fa-spinner fa-spin" style="color: #64748b; font-size: 1.3rem;"></i>
                    </div>
                </div>
            `;
            
            try {
                const resp = await fetch('/api/book/explain-word', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        word: word,
                        sentence: sentence,
                        book_language: currentBook.language,
                        language: localStorage.getItem('paradise_language') || 'pt'
                    })
                });
                
                if (!resp.ok) throw new Error();
                const data = await resp.json();
                
                document.getElementById('word-translation').textContent = data.translation;
                document.getElementById('word-explanation').textContent = data.explanation;
                
                const imgBox = document.getElementById('word-illustration-box');
                if (data.image_url) {
                    const proxyUrl = getProxyUrl(data.image_url);
                    imgBox.innerHTML = `
                        <div class="output-img-container" style="position: relative; width: 100%; height: 100%;">
                            <img src="${proxyUrl}" alt="${word}" referrerpolicy="no-referrer" onclick="window.open('${data.image_url || proxyUrl}', '_blank')" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;">
                            <a href="${proxyUrl}" download="${word}-concept.png" target="_blank" class="img-download-btn" style="position: absolute; bottom: 4px; right: 4px; background: rgba(0, 0, 0, 0.75); border: 1.5px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 6px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 0.8rem; z-index: 10;" title="Baixar conceito"><i class="fa-solid fa-download"></i></a>
                        </div>`;
                } else {
                    imgBox.innerHTML = `<i class="fa-solid fa-image-slash" style="color: #94a3b8; font-size: 1.1rem;"></i>`;
                }
            } catch (e) {
                document.getElementById('word-translation').textContent = "Erro de conexão";
                document.getElementById('word-explanation').textContent = "Não foi possível carregar a tradução contextual.";
                document.getElementById('word-illustration-box').innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: #ef4444; font-size: 1.2rem;"></i>`;
            }
        }

        function closeTranslationBubble() {
            translationBubble.style.display = 'none';
        }

        // On-Demand Illustration
        btnReillustrate.onclick = () => {
            redrawPromptInput.value = '';
            redrawLoading.style.display = 'none';
            btnSubmitRedraw.disabled = false;
            modalRedraw.style.display = 'flex';
        };

        function closeRedrawModal() {
            modalRedraw.style.display = 'none';
        }

        btnSubmitRedraw.onclick = async () => {
            const prompt = redrawPromptInput.value.trim();
            if (!prompt) {
                alert("Por favor, descreva o que deseja desenhar!");
                return;
            }

            redrawLoading.style.display = 'flex';
            btnSubmitRedraw.disabled = true;

            try {
                const resp = await fetch('/api/book/illustrate-scene', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: prompt })
                });

                if (!resp.ok) {
                    const errorData = await resp.json().catch(() => ({}));
                    throw new Error(errorData.error || "Erro de redesenho.");
                }
                const data = await resp.json();

                currentBook.chapters[currentChapterIndex].image_url = data.image_url;
                delete currentBook.chapters[currentChapterIndex].image_error;
                saveBookToHistory(currentBook);
                
                readIllustrationImg.className = 'loading';
                const proxySrc = getProxyUrl(data.image_url);
                readIllustrationImg.src = proxySrc;
                readIllustrationImg.style.display = 'block';
                document.getElementById('illustration-error').style.display = 'none';
                readIllustrationImg.onload = () => readIllustrationImg.className = '';

                // Also update background
                bookScrollBody.style.backgroundImage = `url("${proxySrc}")`;

                closeRedrawModal();
            } catch (e) {
                alert("Erro ao pintar ilustração: " + e.message);
                if (currentBook && currentBook.chapters && currentBook.chapters[currentChapterIndex]) {
                    currentBook.chapters[currentChapterIndex].image_url = null;
                    currentBook.chapters[currentChapterIndex].image_error = e.message;
                    saveBookToHistory(currentBook);
                    renderChapter();
                }
                closeRedrawModal();
            } finally {
                redrawLoading.style.display = 'none';
                btnSubmitRedraw.disabled = false;
            }
        };

        // Close components
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.word-span') && !e.target.closest('#translation-bubble')) {
                closeTranslationBubble();
            }
        });

        // Cookies management elements
        const openConfigBtn = document.getElementById('open-config-btn');
        const closeConfigBtn = document.getElementById('close-config-btn');
        const configModal = document.getElementById('config-modal');
        const saveConfigBtn = document.getElementById('save-config-btn');
        const secure1psidInput = document.getElementById('secure-1psid-input');
        const secure1psidtsInput = document.getElementById('secure-1psidts-input');
        const configError = document.getElementById('config-error');
        const statusDot = document.getElementById('status-dot');
        const statusLabel = document.getElementById('status-label');
        const sessionCheckBtn = document.getElementById('session-check-btn');

        let isConfigured = false;
        let isActive = false;

        async function checkStatus() {
            try {
                const resp = await fetch('/api/status');
                const data = await resp.json();
                
                isConfigured = data.configured;
                isActive = data.active;

                if (isActive) {
                    statusDot.style.backgroundColor = '#10b981';
                    statusLabel.textContent = 'Conectado';
                } else if (isConfigured) {
                    statusDot.style.backgroundColor = '#f59e0b';
                    statusLabel.textContent = 'Inativo/Erro';
                } else {
                    statusDot.style.backgroundColor = '#ef4444';
                    statusLabel.textContent = 'Desconectado';
                }
            } catch (err) {
                statusDot.style.backgroundColor = '#ef4444';
                statusLabel.textContent = 'Offline';
            }
        }

        function getSavedBooks() {
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

        function saveBookToHistory(book) {
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

        function deleteBookFromHistory(bookId, event) {
            if (event) event.stopPropagation();
            if (!confirm("Tem certeza que deseja excluir este livro do seu histórico?")) return;
            let books = getSavedBooks();
            books = books.filter(b => b.id !== bookId);
            localStorage.setItem('paradise_books', JSON.stringify(books));
            renderHistoryList();
        }

        function loadBookFromHistory(bookId) {
            const books = getSavedBooks();
            const book = books.find(b => b.id === bookId);
            if (book) {
                currentBook = book;
                currentChapterIndex = 0;
                panelForm.style.display = 'none';
                panelReader.style.display = 'flex';
                renderChapter();
            }
        }

        function renderHistoryList() {
            const historyPanel = document.getElementById('history-panel');
            const historyList = document.getElementById('history-list');
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

        // Check on boot
        checkStatus();
        renderHistoryList();

        if (sessionCheckBtn) {
            sessionCheckBtn.onclick = (e) => {
                e.stopPropagation();
                checkStatus();
            };
        }

        openConfigBtn.onclick = () => {
            configError.style.display = 'none';
            configModal.style.display = 'flex';
        };

        closeConfigBtn.onclick = () => {
            configModal.style.display = 'none';
        };

        saveConfigBtn.onclick = async () => {
            const sid = secure1psidInput.value.trim();
            const ts = secure1psidtsInput.value.trim();

            if (!sid || !ts) {
                configError.textContent = 'Preencha ambos os cookies!';
                configError.style.display = 'block';
                return;
            }

            saveConfigBtn.disabled = true;
            saveConfigBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';
            configError.style.display = 'none';

            try {
                const resp = await fetch('/api/save-cookies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ secure_1psid: sid, secure_1psidts: ts })
                });
                
                const data = await resp.json();
                if (data.success) {
                    configModal.style.display = 'none';
                    secure1psidInput.value = '';
                    secure1psidtsInput.value = '';
                    await checkStatus();
                } else {
                    configError.textContent = data.error || 'Erro ao inicializar sessão.';
                    configError.style.display = 'block';
                }
            } catch (err) {
                configError.textContent = 'Erro ao enviar dados para o servidor.';
                configError.style.display = 'block';
            } finally {
                saveConfigBtn.disabled = false;
                saveConfigBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar e Autenticar';
            }
        };

        // Persistent Background Contrast Overlay Opacity Regulator
        const bgOpacityRange = document.getElementById('bg-opacity-range');
        const bgOpacityValue = document.getElementById('bg-opacity-value');

        function updateBgOpacity(val) {
            const opacity = val / 100;
            // Update CSS custom property to dynamically change all text boxes background opacity
            document.documentElement.style.setProperty('--text-box-bg-opacity', opacity);
            if (bgOpacityValue) {
                bgOpacityValue.textContent = `${val}%`;
            }
        }

        // Load persisted contrast opacity setting (defaulting to 94%)
        const persistedOpacity = localStorage.getItem('book_bg_opacity');
        const defaultOpacity = persistedOpacity !== null ? parseInt(persistedOpacity, 10) : 94;

        if (bgOpacityRange) {
            bgOpacityRange.value = defaultOpacity;
            updateBgOpacity(defaultOpacity);

            bgOpacityRange.addEventListener('input', (e) => {
                const val = e.target.value;
                updateBgOpacity(val);
                localStorage.setItem('book_bg_opacity', val);
            });
        }

        // Global Language Selection & UI Translation System
        const bookTranslations = {
            pt: {
                brandTitle: "Gerador de Livros Pro",
                panelTitle: "Crie seu Livro de Desenho Animado!",
                panelDesc: "Preencha os dados abaixo e assista ao seu livro ganhar vida com áudio e belas imagens.",
                lblTheme: "Qual será a história?",
                placeholderTheme: "Ex: Um pequeno dinossauro azul que perdeu seu brinquedo, O mistério do castelo voador...",
                lblLevel: "Nível de Leitura",
                lblLang: "Idioma do Livro",
                btnGenerate: "<i class='fa-solid fa-wand-magic-sparkles'></i> Escrever e Ilustrar Livro!",
                lblSavedBooks: "Seus Livros Salvos",
                descSavedBooks: "Clique para ler novamente qualquer um dos livros já gerados neste navegador.",
                connectionChecking: "Verificando...",
                connectionOnline: "Conexão Pro Ativa",
                connectionOffline: "Sem Conexão Pro",
                langOptionPt: "Português",
                langOptionEn: "Inglês",
                langOptionEs: "Espanhol",
                autoPlayActive: "Página Automática: Ativada",
                autoPlayInactive: "Página Automática: Desativada"
            },
            en: {
                brandTitle: "Book Generator Pro",
                panelTitle: "Create your Cartoon Book!",
                panelDesc: "Fill in the fields below and watch your book come to life with audio and beautiful images.",
                lblTheme: "What will the story be about?",
                placeholderTheme: "E.g. A small blue dinosaur who lost his toy, The mystery of the flying castle...",
                lblLevel: "Reading Level",
                lblLang: "Book Language",
                btnGenerate: "<i class='fa-solid fa-wand-magic-sparkles'></i> Write and Illustrate Book!",
                lblSavedBooks: "Your Saved Books",
                descSavedBooks: "Click to read again any of the books already generated in this browser.",
                connectionChecking: "Checking...",
                connectionOnline: "Active Pro Connection",
                connectionOffline: "No Pro Connection",
                langOptionPt: "Portuguese",
                langOptionEn: "English",
                langOptionEs: "Spanish",
                autoPlayActive: "Autoplay Page: Enabled",
                autoPlayInactive: "Autoplay Page: Disabled"
            },
            es: {
                brandTitle: "Generador de Libros Pro",
                panelTitle: "¡Cree su Libro de Dibujos Animados!",
                panelDesc: "Complete los campos a continuación y vea cómo su libro cobra vida con audio y hermosas imágenes.",
                lblTheme: "¿De qué tratará la historia?",
                placeholderTheme: "Ej: Un pequeño dinosaurio azul que perdió su juguete, El misterio del castillo volador...",
                lblLevel: "Nivel de Lectura",
                lblLang: "Idioma del Libro",
                btnGenerate: "<i class='fa-solid fa-wand-magic-sparkles'></i> ¡Escribir e Ilustrar Libro!",
                lblSavedBooks: "Sus Libros Guardados",
                descSavedBooks: "Haga clic para leer nuevamente cualquiera de los libros ya generados en este navegador.",
                connectionChecking: "Verificando...",
                connectionOnline: "Conexión Pro Activa",
                connectionOffline: "Sin Conexión Pro",
                langOptionPt: "Portugués",
                langOptionEn: "Inglés",
                langOptionEs: "Español",
                autoPlayActive: "Página Automática: Activada",
                autoPlayInactive: "Página Automática: Desactivada"
            }
        };

        function applyLanguage(lang) {
            localStorage.setItem("paradise_language", lang);
            document.cookie = `paradise_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
            
            const t = bookTranslations[lang] || bookTranslations.pt;
            
            const brandTitle = document.getElementById('book-brand-title');
            if (brandTitle) brandTitle.textContent = t.brandTitle;
            
            const panelTitle = document.querySelector('.config-form .form-title h2');
            if (panelTitle) panelTitle.textContent = t.panelTitle;
            
            const panelDesc = document.querySelector('.config-form .form-title p');
            if (panelDesc) panelDesc.textContent = t.panelDesc;
            
            const lblTheme = document.querySelector('label[for="book-theme"]');
            if (lblTheme) lblTheme.textContent = t.lblTheme;
            
            const inputTheme = document.getElementById('book-theme');
            if (inputTheme) inputTheme.placeholder = t.placeholderTheme;
            
            const lblLevel = document.querySelector('label[for="book-level"]');
            if (lblLevel) lblLevel.textContent = t.lblLevel;
            
            const lblLang = document.querySelector('label[for="book-lang"]');
            if (lblLang) lblLang.textContent = t.lblLang;
            
            const btnGen = document.getElementById('btn-generate-book');
            if (btnGen) btnGen.innerHTML = t.btnGenerate;
            
            const lblSaved = document.querySelector('.history-panel .form-title h3');
            if (lblSaved) lblSaved.innerHTML = `<i class="fa-solid fa-book-open"></i> ${t.lblSavedBooks}`;
            
            const descSaved = document.querySelector('.history-panel .form-title p');
            if (descSaved) descSaved.textContent = t.descSavedBooks;
            
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
            
            // Auto-select corresponding option in the book-lang selector
            const bookLangSelect = document.getElementById('book-lang');
            if (bookLangSelect) {
                if (lang === 'pt') {
                    bookLangSelect.value = 'Português';
                } else if (lang === 'en') {
                    bookLangSelect.value = 'Inglês';
                } else if (lang === 'es') {
                    bookLangSelect.value = 'Espanhol';
                }
            }
            
            // Set option display text in book-lang select dynamically if needed
            const ptOpt = bookLangSelect ? bookLangSelect.querySelector('option[value="Português"]') : null;
            if (ptOpt) ptOpt.textContent = t.langOptionPt;
            const enOpt = bookLangSelect ? bookLangSelect.querySelector('option[value="Inglês"]') : null;
            if (enOpt) enOpt.textContent = t.langOptionEn;
            const esOpt = bookLangSelect ? bookLangSelect.querySelector('option[value="Espanhol"]') : null;
            if (esOpt) esOpt.textContent = t.langOptionEs;
            
            const langSelect = document.getElementById('global-lang-select');
            if (langSelect) langSelect.value = lang;

            if (typeof updateAutoPlayUI === 'function') {
                updateAutoPlayUI();
            }
        }

        document.getElementById('global-lang-select').addEventListener('change', (e) => {
            applyLanguage(e.target.value);
        });

        // Initialize Page Language
        const currentLang = localStorage.getItem('paradise_language') || 'pt';
        applyLanguage(currentLang);
