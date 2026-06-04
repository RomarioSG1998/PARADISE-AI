        // DOM Elements
        const chatWindow = document.getElementById('chat-window');
        const welcomeScreen = document.getElementById('welcome-screen');
        const promptInput = document.getElementById('prompt-input');
        const sendBtn = document.getElementById('send-btn');
        const statusDot = document.getElementById('status-dot');
        const statusLabel = document.getElementById('status-label');
        const openConfigBtn = document.getElementById('open-config-btn');
        const closeConfigBtn = document.getElementById('close-config-btn');
        const configModal = document.getElementById('config-modal');
        const saveConfigBtn = document.getElementById('save-config-btn');
        const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
        const secure1psidInput = document.getElementById('secure-1psid-input');
        const secure1psidtsInput = document.getElementById('secure-1psidts-input');
        const configError = document.getElementById('config-error');
        const sessionCheckBtn = document.getElementById('session-check-btn');
        const newChatBtn = document.getElementById('new-chat-btn');
        const clearChatTopBtn = document.getElementById('clear-chat-top-btn');
        const featureCards = document.querySelectorAll('.feature-card');

        // State variables
        let isConfigured = false;
        let isActive = false;

        // Auto-resize textarea
        promptInput.addEventListener('input', () => {
            promptInput.style.height = '24px';
            promptInput.style.height = (promptInput.scrollHeight - 6) + 'px';
            sendBtn.disabled = promptInput.value.trim() === '';
        });

        function getProxyUrl(url) {
            if (url && (url.includes("googleusercontent.com") || url.includes("google.com"))) {
                return `/api/proxy-image?url=${encodeURIComponent(url)}`;
            }
            return url;
        }

        // Custom marked renderer to inject referrerpolicy and styles into markdown-embedded images
        const renderer = new marked.Renderer();
        renderer.image = function(href, title, text) {
            const proxyHref = getProxyUrl(href);
            return `<div class="output-img-container" style="max-width: 400px; margin-top: 0.75rem;">
                <img src="${proxyHref}" alt="${text || 'Imagem'}" title="${title || ''}" referrerpolicy="no-referrer" onclick="window.open('${href}', '_blank')" />
                <a href="${proxyHref}" download="gemini-output.png" target="_blank" class="img-download-btn"><i class="fa-solid fa-download"></i></a>
            </div>`;
        };

        // Initialize marked with highlight.js syntax highlighting
        marked.setOptions({
            renderer: renderer,
            highlight: function(code, lang) {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            },
            langPrefix: 'hljs language-'
        });

        // Check Backend Status on Boot
        async function checkStatus() {
            try {
                const resp = await fetch('/api/status');
                const data = await resp.json();
                
                isConfigured = data.configured;
                isActive = data.active;

                if (isActive) {
                    statusDot.className = 'dot active';
                    statusLabel.textContent = data.has_api_key ? 'Conectado (API Key Ativa)' : 'Conectado (Cookies Ativos)';
                } else if (isConfigured) {
                    statusDot.className = 'dot warning';
                    statusLabel.textContent = 'Configuração Salva (Inativo/Erro)';
                } else {
                    statusDot.className = 'dot';
                    statusLabel.textContent = 'Não configurado';
                }
            } catch (err) {
                statusDot.className = 'dot';
                statusLabel.textContent = 'Servidor Offline';
            }
        }

        // Open Modal
        openConfigBtn.addEventListener('click', () => {
            configError.style.display = 'none';
            configModal.style.display = 'flex';
        });

        // Close Modal
        closeConfigBtn.addEventListener('click', () => {
            configModal.style.display = 'none';
        });

        // Save Config Cookies
        saveConfigBtn.addEventListener('click', async () => {
            const apiKey = geminiApiKeyInput.value.trim();
            const sid = secure1psidInput.value.trim();
            const ts = secure1psidtsInput.value.trim();

            if (!apiKey && (!sid || !ts)) {
                configError.textContent = 'Forneça a API Key ou ambos os cookies!';
                configError.style.display = 'block';
                return;
            }

            saveConfigBtn.disabled = true;
            saveConfigBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando configuração...';
            configError.style.display = 'none';

            try {
                const resp = await fetch('/api/save-cookies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        gemini_api_key: apiKey,
                        secure_1psid: sid, 
                        secure_1psidts: ts 
                    })
                });
                
                const data = await resp.json();
                if (data.success) {
                    configModal.style.display = 'none';
                    geminiApiKeyInput.value = '';
                    secure1psidInput.value = '';
                    secure1psidtsInput.value = '';
                    await checkStatus();
                } else {
                    configError.textContent = data.error || 'Erro ao inicializar sessão com as credenciais fornecidas.';
                    configError.style.display = 'block';
                }
            } catch (err) {
                configError.textContent = 'Erro ao enviar dados para o servidor.';
                configError.style.display = 'block';
            } finally {
                saveConfigBtn.disabled = false;
                saveConfigBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Configuração';
            }
        });

        let chatHistory = [];

        function saveChatHistory() {
            localStorage.setItem('paradise_chat_history', JSON.stringify(chatHistory));
        }

        function loadChatHistory() {
            const history = localStorage.getItem('paradise_chat_history');
            if (history) {
                try {
                    chatHistory = JSON.parse(history) || [];
                    if (chatHistory.length > 0) {
                        const welcome = document.getElementById('welcome-screen');
                        if (welcome) welcome.remove();
                        chatHistory.forEach(msg => {
                            appendMessageToDom(msg.sender, msg.text, msg.images, msg.audio);
                        });
                    }
                } catch (e) {
                    console.error("Failed to load chat history", e);
                    chatHistory = [];
                }
            }
        }

        // Reset Conversation
        function clearChat() {
            chatHistory = [];
            localStorage.removeItem('paradise_chat_history');

            // Keep welcome screen and delete the rest
            const welcome = welcomeScreen.cloneNode(true);
            chatWindow.innerHTML = '';
            chatWindow.appendChild(welcome);
            
            // Re-attach card click listeners
            const cards = chatWindow.querySelectorAll('.feature-card');
            cards.forEach(card => {
                card.addEventListener('click', () => {
                    const promptText = card.getAttribute('data-prompt');
                    promptInput.value = promptText;
                    promptInput.style.height = '24px';
                    promptInput.style.height = (promptInput.scrollHeight - 6) + 'px';
                    sendBtn.disabled = false;
                    promptInput.focus();
                });
            });
        }

        newChatBtn.addEventListener('click', clearChat);
        clearChatTopBtn.addEventListener('click', clearChat);

        // Feature cards quick prompts
        featureCards.forEach(card => {
            card.addEventListener('click', () => {
                const promptText = card.getAttribute('data-prompt');
                promptInput.value = promptText;
                promptInput.style.height = '24px';
                promptInput.style.height = (promptInput.scrollHeight - 6) + 'px';
                sendBtn.disabled = false;
                promptInput.focus();
            });
        });

        // Render message in chat window
        function appendMessageToDom(sender, text, images = [], audio = null) {
            // Hide welcome screen if showing
            const welcome = document.getElementById('welcome-screen');
            if (welcome) welcome.remove();

            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${sender}`;

            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'avatar';
            avatarDiv.innerHTML = sender === 'user' ? '<i class="fa-regular fa-user"></i>' : '<i class="fa-solid fa-wand-magic-sparkles"></i>';

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'bubble';
            
            if (sender === 'ai') {
                bubbleDiv.innerHTML = marked.parse(text);
                
                // If there are images and they are not already embedded in the parsed HTML text
                if (images.length > 0) {
                    const gallery = document.createElement('div');
                    gallery.className = 'output-gallery';
                    let addedAny = false;
                    
                    images.forEach(imgUrl => {
                        if (!bubbleDiv.innerHTML.includes(imgUrl)) {
                            addedAny = true;
                            const container = document.createElement('div');
                            container.className = 'output-img-container';
                            
                            const proxyUrl = getProxyUrl(imgUrl);
                            const img = document.createElement('img');
                            img.src = proxyUrl;
                            img.setAttribute('referrerpolicy', 'no-referrer');
                            img.alt = 'Imagem gerada';
                            img.onclick = () => window.open(imgUrl, '_blank');
                            
                            const dl = document.createElement('a');
                            dl.href = proxyUrl;
                            dl.download = 'gemini-output.png';
                            dl.target = '_blank';
                            dl.className = 'img-download-btn';
                            dl.innerHTML = '<i class="fa-solid fa-download"></i>';
                            
                            container.appendChild(img);
                            container.appendChild(dl);
                            gallery.appendChild(container);
                        }
                    });
                    
                    if (addedAny) {
                        bubbleDiv.appendChild(gallery);
                    }
                }
            } else {
                if (audio) {
                    bubbleDiv.innerHTML = `
                        <div class="audio-message">
                            <div class="audio-player-wrapper">
                                <audio src="${audio}" controls></audio>
                            </div>
                            <div style="font-size: 0.95rem; color: #d1fae5; line-height: 1.4; border-top: 1px solid rgba(0, 255, 65, 0.15); padding-top: 0.5rem; margin-top: 0.25rem;">
                                <i class="fa-solid fa-quote-left" style="color:var(--text-secondary); font-size:0.8rem; margin-right: 0.25rem;"></i>
                                ${text}
                            </div>
                        </div>
                    `;
                } else {
                    bubbleDiv.textContent = text;
                }
            }

            messageDiv.appendChild(avatarDiv);
            messageDiv.appendChild(bubbleDiv);
            chatWindow.appendChild(messageDiv);
            
            // Auto scroll to bottom
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        function appendMessage(sender, text, images = [], audio = null) {
            appendMessageToDom(sender, text, images, audio);
            chatHistory.push({ sender, text, images, audio });
            saveChatHistory();
        }

        // Render Loading Indicator
        function showLoading() {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message ai loading-indicator';
            
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'avatar';
            avatarDiv.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
            
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'bubble';
            bubbleDiv.innerHTML = `
                <div class="loading-dots">
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
            `;
            
            loadingDiv.appendChild(avatarDiv);
            loadingDiv.appendChild(bubbleDiv);
            chatWindow.appendChild(loadingDiv);
            chatWindow.scrollTop = chatWindow.scrollHeight;
            return loadingDiv;
        }

        // Send Message
        async function sendMessage() {
            const text = promptInput.value.trim();
            if (!text) return;

            promptInput.value = '';
            promptInput.style.height = '24px';
            sendBtn.disabled = true;

            appendMessage('user', text);
            const loader = showLoading();

            try {
                const resp = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });

                loader.remove();

                const data = await resp.json();
                
                if (resp.ok) {
                    appendMessage('ai', data.text, data.images);
                } else {
                    appendMessage('ai', `⚠️ **Erro:** ${data.error || 'Não foi possível processar a requisição.'}`);
                    if (data.needs_config) {
                        isConfigured = false;
                        isActive = false;
                        statusDot.className = 'dot';
                        statusLabel.textContent = 'Não configurado (Erro/Expirado)';
                        // Prompt cookie modal
                        configModal.style.display = 'flex';
                    }
                }
            } catch (err) {
                loader.remove();
                appendMessage('ai', `⚠️ **Erro de Conexão:** Falha ao comunicar com o servidor proxy.`);
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sessionCheckBtn.addEventListener('click', checkStatus);

        // ----------------- AUDIO RECORDING & PERSISTENCE -----------------
        let mediaRecorder;
        let audioChunks = [];
        let voiceSpeechRecognition;
        let recordedTranscript = '';
        let isMicRecording = false;

        async function toggleMicRecording() {
            const micBtn = document.getElementById('mic-btn');
            if (!isMicRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    recordedTranscript = '';
                    
                    mediaRecorder.ondataavailable = (event) => {
                        audioChunks.push(event.data);
                    };
                    
                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        
                        const reader = new FileReader();
                        reader.readAsDataURL(audioBlob);
                        reader.onloadend = async () => {
                            const base64Audio = reader.result;
                            const transcriptText = recordedTranscript.trim() || "...";
                            
                            // Clear input
                            promptInput.value = '';
                            promptInput.dispatchEvent(new Event('input'));
                            
                            // Append User audio message and persist
                            appendMessage('user', transcriptText, [], base64Audio);
                            
                            const loader = showLoading();
                            try {
                                const resp = await fetch('/api/chat', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ message: transcriptText })
                                });
                                loader.remove();
                                const data = await resp.json();
                                if (resp.ok) {
                                    appendMessage('ai', data.text, data.images);
                                } else {
                                    appendMessage('ai', `⚠️ **Erro:** ${data.error || 'Não foi possível processar a requisição.'}`);
                                }
                            } catch (err) {
                                loader.remove();
                                appendMessage('ai', `⚠️ **Erro de Conexão:** Falha ao comunicar com o servidor proxy.`);
                            }
                        };
                        
                        stream.getTracks().forEach(track => track.stop());
                    };
                    
                    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
                    if (SpeechRec) {
                        voiceSpeechRecognition = new SpeechRec();
                        voiceSpeechRecognition.lang = 'pt-BR';
                        voiceSpeechRecognition.continuous = true;
                        voiceSpeechRecognition.interimResults = true;
                        
                        voiceSpeechRecognition.onresult = (event) => {
                            let interimTranscript = '';
                            for (let i = event.resultIndex; i < event.results.length; ++i) {
                                if (event.results[i].isFinal) {
                                    recordedTranscript += event.results[i][0].transcript;
                                } else {
                                    interimTranscript += event.results[i][0].transcript;
                                }
                            }
                            promptInput.value = recordedTranscript + interimTranscript;
                            promptInput.dispatchEvent(new Event('input'));
                        };
                        
                        voiceSpeechRecognition.start();
                    }
                    
                    mediaRecorder.start();
                    isMicRecording = true;
                    micBtn.classList.add('recording');
                    micBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
                    promptInput.placeholder = "Gravando áudio... Clique de novo para parar.";
                } catch (err) {
                    console.error("Erro ao acessar microfone", err);
                    alert("Não foi possível acessar o microfone. Verifique as permissões de áudio.");
                }
            } else {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
                if (voiceSpeechRecognition) {
                    voiceSpeechRecognition.stop();
                }
                isMicRecording = false;
                micBtn.classList.remove('recording');
                micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                promptInput.placeholder = "Pergunte ao Gemini Pro...";
            }
        }

        document.getElementById('mic-btn').addEventListener('click', toggleMicRecording);


        // ----------------- SYNCHRONOUS VOICE MODE (CHAMADA DE VOZ) -----------------
        let audioCtx;
        let analyser;
        let micStream;
        let visualizerAnimationId;
        let ttsAudioElement = null;
        let wordRevealInterval = null;
        let voiceRecognition = null;
        let voiceActive = false;
        let isMuted = false;
        let isAiSpeaking = false;

        async function startVisualizer(stream) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            
            const canvas = document.getElementById('waveform-canvas');
            const canvasCtx = canvas.getContext('2d');
            
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            function draw() {
                visualizerAnimationId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);
                
                canvasCtx.fillStyle = 'rgba(2, 5, 3, 0.3)';
                canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let barHeight;
                let x = 0;
                
                for (let i = 0; i < bufferLength; i++) {
                    barHeight = dataArray[i] / 1.5;
                    canvasCtx.fillStyle = `rgb(0, ${Math.min(255, barHeight + 100)}, 65)`;
                    canvasCtx.shadowBlur = 4;
                    canvasCtx.shadowColor = '#00ff41';
                    
                    const y = (canvas.height - barHeight) / 2;
                    canvasCtx.fillRect(x, y, barWidth - 2, barHeight);
                    x += barWidth;
                }
            }
            draw();
        }

        function cleanMarkdownForSpeech(text) {
            if (!text) return "";
            
            let clean = text;
            
            // 1. Remove code blocks entirely (we don't want code read aloud in voice call)
            clean = clean.replace(/```[\s\S]*?```/g, " [bloco de código] ");
            clean = clean.replace(/`([^`]+)`/g, "$1");
            
            // 2. Remove headers symbols (#, ##, etc.) at the start of lines
            clean = clean.replace(/^#+\s+/gm, "");
            
            // 3. Remove bold/italic markers (*, **, _, __)
            clean = clean.replace(/\*\*([^*]+)\*\*/g, "$1");
            clean = clean.replace(/\*([^*]+)\*/g, "$1");
            clean = clean.replace(/__([^_]+)__/g, "$1");
            clean = clean.replace(/_([^_]+)_/g, "$1");
            
            // 4. Remove links [text](url) -> keep only text
            clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
            
            // 5. Remove bullet list indicators (* or - or + or 1. at start of lines)
            clean = clean.replace(/^[\s]*[-*+]\s+/gm, "");
            clean = clean.replace(/^[\s]*\d+\.\s+/gm, "");
            
            // 6. Remove HTML tags
            clean = clean.replace(/<[^>]*>/g, "");
            
            // 7. Clean up extra spaces/newlines
            clean = clean.replace(/\n+/g, " ");
            clean = clean.replace(/\s+/g, " ").trim();
            
            return clean;
        }

        function speakText(text, onEndCallback) {
            // Clean up any running audio or text intervals
            if (ttsAudioElement) {
                ttsAudioElement.pause();
                ttsAudioElement = null;
            }
            if (wordRevealInterval) {
                clearInterval(wordRevealInterval);
                wordRevealInterval = null;
            }
            
            isAiSpeaking = true;
            if (voiceRecognition) {
                voiceRecognition.abort();
            }
            
            document.getElementById('voice-transcript').style.display = 'none';
            const aiResponseBox = document.getElementById('voice-ai-response');
            aiResponseBox.style.display = 'block';
            aiResponseBox.textContent = "";
            
            const cleanText = cleanMarkdownForSpeech(text);
            
            const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}`;
            ttsAudioElement = new Audio(ttsUrl);
            
            // Set playback rate based on speed slider
            const speedSlider = document.getElementById('speech-speed');
            const speedVal = speedSlider ? parseFloat(speedSlider.value) : 1.0;
            
            // Wait for metadata to load to set playbackRate safely and calculate reveal speed
            ttsAudioElement.addEventListener('loadedmetadata', () => {
                const duration = ttsAudioElement.duration; // duration in seconds
                const words = cleanText.split(/\s+/);
                
                // Set speed rate on playback
                ttsAudioElement.playbackRate = speedVal;
                
                if (duration && words.length > 0) {
                    const totalMs = (duration * 1000) / speedVal;
                    const intervalTime = totalMs / words.length;
                    
                    let wordIndex = 0;
                    aiResponseBox.textContent = "";
                    
                    wordRevealInterval = setInterval(() => {
                        if (!isAiSpeaking || wordIndex >= words.length) {
                            clearInterval(wordRevealInterval);
                            return;
                        }
                        const spokenPart = words.slice(0, wordIndex + 1).join(" ");
                        aiResponseBox.textContent = spokenPart;
                        aiResponseBox.scrollTop = aiResponseBox.scrollHeight;
                        wordIndex++;
                    }, intervalTime);
                } else {
                    // Fallback to instantly showing all text if duration is zero/broken
                    aiResponseBox.textContent = cleanText;
                }
            });
            
            // Fallback in case metadata loading fails or takes too long
            const fallbackTimeout = setTimeout(() => {
                if (aiResponseBox.textContent === "") {
                    aiResponseBox.textContent = cleanText;
                }
            }, 3000);
            
            ttsAudioElement.addEventListener('play', () => {
                isAiSpeaking = true;
            });
            
            ttsAudioElement.addEventListener('ended', () => {
                clearTimeout(fallbackTimeout);
                isAiSpeaking = false;
                if (wordRevealInterval) {
                    clearInterval(wordRevealInterval);
                }
                if (onEndCallback) onEndCallback();
            });
            
            ttsAudioElement.addEventListener('error', (e) => {
                clearTimeout(fallbackTimeout);
                console.error("Erro no áudio do TTS:", e);
                isAiSpeaking = false;
                if (wordRevealInterval) {
                    clearInterval(wordRevealInterval);
                }
                if (onEndCallback) onEndCallback();
            });
            
            ttsAudioElement.play().catch(err => {
                clearTimeout(fallbackTimeout);
                console.error("Erro ao iniciar reprodução:", err);
                isAiSpeaking = false;
                if (wordRevealInterval) {
                    clearInterval(wordRevealInterval);
                }
                if (onEndCallback) onEndCallback();
            });
        }

        function startListening() {
            if (!voiceActive || isMuted || isAiSpeaking) return;
            
            // Toggle visibility: show transcript, hide AI response
            document.getElementById('voice-transcript').style.display = 'block';
            document.getElementById('voice-ai-response').style.display = 'none';
            
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRec) return;
            
            if (!voiceRecognition) {
                voiceRecognition = new SpeechRec();
                voiceRecognition.lang = 'pt-BR';
                voiceRecognition.continuous = false;
                voiceRecognition.interimResults = true;
                
                voiceRecognition.onstart = () => {
                    document.getElementById('voice-status').textContent = "Escutando...";
                    document.getElementById('voice-status').className = "voice-status listening";
                };
                
                voiceRecognition.onresult = (event) => {
                    if (isAiSpeaking) return;
                    
                    let transcript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        transcript += event.results[i][0].transcript;
                    }
                    document.getElementById('voice-transcript').textContent = `"${transcript}"`;
                    
                    if (event.results[event.results.length - 1].isFinal) {
                        sendVoiceInput(transcript);
                    }
                };
                
                voiceRecognition.onerror = (event) => {
                    console.error("Speech recognition error:", event.error);
                    if (event.error === 'no-speech') {
                        setTimeout(startListening, 500);
                    }
                };
                
                voiceRecognition.onend = () => {
                    if (voiceActive && !isMuted && !isAiSpeaking) {
                        setTimeout(startListening, 300);
                    }
                };
            }
            
            try {
                voiceRecognition.start();
            } catch (e) {
                // already started
            }
        }

        async function sendVoiceInput(text) {
            if (!text.trim()) return;
            
            isAiSpeaking = true;
            if (voiceRecognition) {
                voiceRecognition.abort();
            }
            
            // Toggle visibility: show transcript, hide AI response
            document.getElementById('voice-transcript').style.display = 'block';
            document.getElementById('voice-ai-response').style.display = 'none';
            
            document.getElementById('voice-status').textContent = "Processando...";
            document.getElementById('voice-status').className = "voice-status thinking";
            
            // Append user text message to background log
            appendMessage('user', text);
            
            try {
                const resp = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });
                
                const data = await resp.json();
                
                if (resp.ok) {
                    // Update layout is handled in speakText
                    appendMessage('ai', data.text, data.images);
                    
                    document.getElementById('voice-status').textContent = "Falando...";
                    document.getElementById('voice-status').className = "voice-status speaking";
                    
                    speakText(data.text, () => {
                        if (voiceActive) {
                            startListening();
                        }
                    });
                } else {
                    const errText = data.error || 'Não foi possível processar a requisição.';
                    speakText(`Desculpe, ocorreu um erro: ${errText}`, () => {
                        if (voiceActive) startListening();
                    });
                }
            } catch (err) {
                console.error("Erro no chat por voz", err);
                speakText("Erro de conexão com o servidor.", () => {
                    if (voiceActive) startListening();
                });
            }
        }

        async function startVoiceCall() {
            voiceActive = true;
            isMuted = false;
            isAiSpeaking = false;
            document.getElementById('chat-window').classList.add('voice-active');
            document.getElementById('voice-overlay').style.display = 'flex';
            
            // Initial visibility state
            document.getElementById('voice-transcript').style.display = 'block';
            document.getElementById('voice-transcript').textContent = '"Iniciando..."';
            document.getElementById('voice-ai-response').style.display = 'none';
            document.getElementById('voice-ai-response').textContent = '';
            
            document.getElementById('voice-status').textContent = "Iniciando...";
            document.getElementById('voice-status').className = "voice-status";
            
            const muteBtn = document.getElementById('mute-voice-btn');
            muteBtn.classList.remove('muted');
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';

            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                startVisualizer(micStream);
                
                speakText("Canal seguro Mr. Robot estabelecido. Sou todo ouvidos.", () => {
                    startListening();
                });
            } catch (e) {
                console.error("Erro no microfone", e);
                alert("Acesso ao microfone negado ou indisponível.");
                endVoiceCall();
            }
        }

        function endVoiceCall() {
            voiceActive = false;
            isAiSpeaking = false;
            document.getElementById('chat-window').classList.remove('voice-active');
            if (voiceRecognition) {
                voiceRecognition.abort();
            }
            if (ttsAudioElement) {
                ttsAudioElement.pause();
                ttsAudioElement = null;
            }
            if (wordRevealInterval) {
                clearInterval(wordRevealInterval);
                wordRevealInterval = null;
            }
            if (visualizerAnimationId) {
                cancelAnimationFrame(visualizerAnimationId);
            }
            if (audioCtx && audioCtx.state !== 'closed') {
                audioCtx.close();
            }
            if (micStream) {
                micStream.getTracks().forEach(track => track.stop());
            }
            document.getElementById('voice-overlay').style.display = 'none';
        }

        function toggleVoiceMute() {
            const muteBtn = document.getElementById('mute-voice-btn');
            isMuted = !isMuted;
            if (isMuted) {
                muteBtn.classList.add('muted');
                muteBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
                if (voiceRecognition) {
                    voiceRecognition.abort();
                }
                document.getElementById('voice-status').textContent = "Mutado";
                document.getElementById('voice-status').className = "voice-status";
            } else {
                muteBtn.classList.remove('muted');
                muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                startListening();
            }
        }

        // Speed slider value listener
        const speedSlider = document.getElementById('speech-speed');
        const speedValText = document.getElementById('speed-val');
        if (speedSlider && speedValText) {
            speedSlider.addEventListener('input', () => {
                speedValText.textContent = `${parseFloat(speedSlider.value).toFixed(1)}x`;
                if (ttsAudioElement && isAiSpeaking) {
                    ttsAudioElement.playbackRate = parseFloat(speedSlider.value);
                }
            });
        }

        document.getElementById('voice-mode-btn').addEventListener('click', startVoiceCall);
        document.getElementById('end-voice-btn').addEventListener('click', endVoiceCall);
        document.getElementById('mute-voice-btn').addEventListener('click', toggleVoiceMute);

        // Boot
        checkStatus();
        loadChatHistory();
