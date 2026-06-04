import { state } from './state.js';
import { elements } from './elements.js';
import { appendMessage, showLoading } from './history.js';

export async function toggleMicRecording() {
    if (!state.isMicRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream);
            state.audioChunks = [];
            state.recordedTranscript = '';
            
            state.mediaRecorder.ondataavailable = (event) => {
                state.audioChunks.push(event.data);
            };
            
            state.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
                
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = reader.result;
                    const transcriptText = state.recordedTranscript.trim() || "...";
                    
                    elements.promptInput.value = '';
                    elements.promptInput.dispatchEvent(new Event('input'));
                    
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
                state.voiceSpeechRecognition = new SpeechRec();
                state.voiceSpeechRecognition.lang = 'pt-BR';
                state.voiceSpeechRecognition.continuous = true;
                state.voiceSpeechRecognition.interimResults = true;
                
                state.voiceSpeechRecognition.onresult = (event) => {
                    let interimTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            state.recordedTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }
                    elements.promptInput.value = state.recordedTranscript + interimTranscript;
                    elements.promptInput.dispatchEvent(new Event('input'));
                };
                
                state.voiceSpeechRecognition.start();
            }
            
            state.mediaRecorder.start();
            state.isMicRecording = true;
            elements.micBtn.classList.add('recording');
            elements.micBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
            elements.promptInput.placeholder = "Gravando áudio... Clique de novo para parar.";
        } catch (err) {
            console.error("Erro ao acessar microfone", err);
            alert("Não foi possível acessar o microfone. Verifique as permissões de áudio.");
        }
    } else {
        if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
            state.mediaRecorder.stop();
        }
        if (state.voiceSpeechRecognition) {
            state.voiceSpeechRecognition.stop();
        }
        state.isMicRecording = false;
        elements.micBtn.classList.remove('recording');
        elements.micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        elements.promptInput.placeholder = "Pergunte ao Gemini Pro...";
    }
}
