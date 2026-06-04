import { state } from './state.js';
import { elements } from './elements.js';
import { appendMessage } from './history.js';

export async function startVisualizer(stream) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = state.audioCtx.createMediaStreamSource(stream);
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 256;
    source.connect(state.analyser);
    
    const canvasCtx = elements.waveformCanvas.getContext('2d');
    
    elements.waveformCanvas.width = elements.waveformCanvas.parentElement.clientWidth;
    elements.waveformCanvas.height = elements.waveformCanvas.parentElement.clientHeight;
    
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        state.visualizerAnimationId = requestAnimationFrame(draw);
        state.analyser.getByteFrequencyData(dataArray);
        
        canvasCtx.fillStyle = 'rgba(2, 5, 3, 0.3)';
        canvasCtx.fillRect(0, 0, elements.waveformCanvas.width, elements.waveformCanvas.height);
        
        const barWidth = (elements.waveformCanvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 1.5;
            canvasCtx.fillStyle = `rgb(0, ${Math.min(255, barHeight + 100)}, 65)`;
            canvasCtx.shadowBlur = 4;
            canvasCtx.shadowColor = '#00ff41';
            
            const y = (elements.waveformCanvas.height - barHeight) / 2;
            canvasCtx.fillRect(x, y, barWidth - 2, barHeight);
            x += barWidth;
        }
    }
    draw();
}

export function cleanMarkdownForSpeech(text) {
    if (!text) return "";
    let clean = text;
    clean = clean.replace(/```[\s\S]*?```/g, " [bloco de código] ");
    clean = clean.replace(/`([^`]+)`/g, "$1");
    clean = clean.replace(/^#+\s+/gm, "");
    clean = clean.replace(/\*\*([^*]+)\*\*/g, "$1");
    clean = clean.replace(/\*([^*]+)\*/g, "$1");
    clean = clean.replace(/__([^_]+)__/g, "$1");
    clean = clean.replace(/_([^_]+)_/g, "$1");
    clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    clean = clean.replace(/^[\s]*[-*+]\s+/gm, "");
    clean = clean.replace(/^[\s]*\d+\.\s+/gm, "");
    clean = clean.replace(/<[^>]*>/g, "");
    clean = clean.replace(/\n+/g, " ");
    clean = clean.replace(/\s+/g, " ").trim();
    return clean;
}

export function speakText(text, onEndCallback) {
    if (state.ttsAudioElement) {
        state.ttsAudioElement.pause();
        state.ttsAudioElement = null;
    }
    if (state.wordRevealInterval) {
        clearInterval(state.wordRevealInterval);
        state.wordRevealInterval = null;
    }
    
    state.isAiSpeaking = true;
    if (state.voiceRecognition) {
        state.voiceRecognition.abort();
    }
    
    elements.voiceTranscript.style.display = 'none';
    elements.voiceAiResponse.style.display = 'block';
    elements.voiceAiResponse.textContent = "";
    
    const cleanText = cleanMarkdownForSpeech(text);
    const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}`;
    state.ttsAudioElement = new Audio(ttsUrl);
    
    const speedVal = elements.speechSpeed ? parseFloat(elements.speechSpeed.value) : 1.0;
    
    state.ttsAudioElement.addEventListener('loadedmetadata', () => {
        const duration = state.ttsAudioElement.duration;
        const words = cleanText.split(/\s+/);
        
        state.ttsAudioElement.playbackRate = speedVal;
        
        if (duration && words.length > 0) {
            const totalMs = (duration * 1000) / speedVal;
            const intervalTime = totalMs / words.length;
            
            let wordIndex = 0;
            elements.voiceAiResponse.textContent = "";
            
            state.wordRevealInterval = setInterval(() => {
                if (!state.isAiSpeaking || wordIndex >= words.length) {
                    clearInterval(state.wordRevealInterval);
                    return;
                }
                const spokenPart = words.slice(0, wordIndex + 1).join(" ");
                elements.voiceAiResponse.textContent = spokenPart;
                elements.voiceAiResponse.scrollTop = elements.voiceAiResponse.scrollHeight;
                wordIndex++;
            }, intervalTime);
        } else {
            elements.voiceAiResponse.textContent = cleanText;
        }
    });
    
    const fallbackTimeout = setTimeout(() => {
        if (elements.voiceAiResponse.textContent === "") {
            elements.voiceAiResponse.textContent = cleanText;
        }
    }, 3000);
    
    state.ttsAudioElement.addEventListener('play', () => {
        state.isAiSpeaking = true;
    });
    
    state.ttsAudioElement.addEventListener('ended', () => {
        clearTimeout(fallbackTimeout);
        state.isAiSpeaking = false;
        if (state.wordRevealInterval) {
            clearInterval(state.wordRevealInterval);
        }
        if (onEndCallback) onEndCallback();
    });
    
    state.ttsAudioElement.addEventListener('error', (e) => {
        clearTimeout(fallbackTimeout);
        console.error("Erro no áudio do TTS:", e);
        state.isAiSpeaking = false;
        if (state.wordRevealInterval) {
            clearInterval(state.wordRevealInterval);
        }
        if (onEndCallback) onEndCallback();
    });
    
    state.ttsAudioElement.play().catch(err => {
        clearTimeout(fallbackTimeout);
        console.error("Erro ao iniciar reprodução:", err);
        state.isAiSpeaking = false;
        if (state.wordRevealInterval) {
            clearInterval(state.wordRevealInterval);
        }
        if (onEndCallback) onEndCallback();
    });
}

export function startListening() {
    if (!state.voiceActive || state.isMuted || state.isAiSpeaking) return;
    
    elements.voiceTranscript.style.display = 'block';
    elements.voiceAiResponse.style.display = 'none';
    
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    
    if (!state.voiceRecognition) {
        state.voiceRecognition = new SpeechRec();
        state.voiceRecognition.lang = 'pt-BR';
        state.voiceRecognition.continuous = false;
        state.voiceRecognition.interimResults = true;
        
        state.voiceRecognition.onstart = () => {
            elements.voiceStatus.textContent = "Escutando...";
            elements.voiceStatus.className = "voice-status listening";
        };
        
        state.voiceRecognition.onresult = (event) => {
            if (state.isAiSpeaking) return;
            
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            elements.voiceTranscript.textContent = `"${transcript}"`;
            
            if (event.results[event.results.length - 1].isFinal) {
                sendVoiceInput(transcript);
            }
        };
        
        state.voiceRecognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            if (event.error === 'no-speech') {
                setTimeout(startListening, 500);
            }
        };
        
        state.voiceRecognition.onend = () => {
            if (state.voiceActive && !state.isMuted && !state.isAiSpeaking) {
                setTimeout(startListening, 300);
            }
        };
    }
    
    try {
        state.voiceRecognition.start();
    } catch (e) {
        // already started
    }
}

export async function sendVoiceInput(text) {
    if (!text.trim()) return;
    
    state.isAiSpeaking = true;
    if (state.voiceRecognition) {
        state.voiceRecognition.abort();
    }
    
    elements.voiceTranscript.style.display = 'block';
    elements.voiceAiResponse.style.display = 'none';
    
    elements.voiceStatus.textContent = "Processando...";
    elements.voiceStatus.className = "voice-status thinking";
    
    appendMessage('user', text);
    
    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        
        const data = await resp.json();
        
        if (resp.ok) {
            appendMessage('ai', data.text, data.images);
            
            elements.voiceStatus.textContent = "Falando...";
            elements.voiceStatus.className = "voice-status speaking";
            
            speakText(data.text, () => {
                if (state.voiceActive) {
                    startListening();
                }
            });
        } else {
            const errText = data.error || 'Não foi possível processar a requisição.';
            speakText(`Desculpe, ocorreu um erro: ${errText}`, () => {
                if (state.voiceActive) startListening();
            });
        }
    } catch (err) {
        console.error("Erro no chat por voz", err);
        speakText("Erro de conexão com o servidor.", () => {
            if (state.voiceActive) startListening();
        });
    }
}

export async function startVoiceCall() {
    state.voiceActive = true;
    state.isMuted = false;
    state.isAiSpeaking = false;
    elements.chatWindow.classList.add('voice-active');
    elements.voiceOverlay.style.display = 'flex';
    
    elements.voiceTranscript.style.display = 'block';
    elements.voiceTranscript.textContent = '"Iniciando..."';
    elements.voiceAiResponse.style.display = 'none';
    elements.voiceAiResponse.textContent = '';
    
    elements.voiceStatus.textContent = "Iniciando...";
    elements.voiceStatus.className = "voice-status";
    
    elements.muteVoiceBtn.classList.remove('muted');
    elements.muteVoiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';

    try {
        state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startVisualizer(state.micStream);
        
        speakText("Canal seguro Mr. Robot estabelecido. Sou todo ouvidos.", () => {
            startListening();
        });
    } catch (e) {
        console.error("Erro no microfone", e);
        alert("Acesso ao microfone negado ou indisponível.");
        endVoiceCall();
    }
}

export function endVoiceCall() {
    state.voiceActive = false;
    state.isAiSpeaking = false;
    elements.chatWindow.classList.remove('voice-active');
    if (state.voiceRecognition) {
        state.voiceRecognition.abort();
    }
    if (state.ttsAudioElement) {
        state.ttsAudioElement.pause();
        state.ttsAudioElement = null;
    }
    if (state.wordRevealInterval) {
        clearInterval(state.wordRevealInterval);
        state.wordRevealInterval = null;
    }
    if (state.visualizerAnimationId) {
        cancelAnimationFrame(state.visualizerAnimationId);
    }
    if (state.audioCtx && state.audioCtx.state !== 'closed') {
        state.audioCtx.close();
    }
    if (state.micStream) {
        state.micStream.getTracks().forEach(track => track.stop());
    }
    elements.voiceOverlay.style.display = 'none';
}

export function toggleVoiceMute() {
    state.isMuted = !state.isMuted;
    if (state.isMuted) {
        elements.muteVoiceBtn.classList.add('muted');
        elements.muteVoiceBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        if (state.voiceRecognition) {
            state.voiceRecognition.abort();
        }
        elements.voiceStatus.textContent = "Mutado";
        elements.voiceStatus.className = "voice-status";
    } else {
        elements.muteVoiceBtn.classList.remove('muted');
        elements.muteVoiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        startListening();
    }
}
