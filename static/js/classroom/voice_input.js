/**
 * voice_input.js — Shared voice-to-text helper for classroom inputs.
 * Uses the Web Speech API (SpeechRecognition). Works in Chrome/Edge.
 * Falls back gracefully on unsupported browsers.
 */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Attach a voice-input mic button to a text input/textarea.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} inputEl  — the target field
 * @param {HTMLButtonElement}                   btnEl    — the mic button
 * @param {string}                              lang     — BCP-47 lang code e.g. 'pt-BR'
 */
export function attachVoiceInput(inputEl, btnEl, getLang) {
    if (!SpeechRecognition) {
        btnEl.title = 'Gravação de voz não suportada neste navegador';
        btnEl.style.opacity = '0.4';
        btnEl.style.cursor  = 'not-allowed';
        btnEl.disabled = true;
        return;
    }

    let recognition = null;
    let isRecording = false;

    function startRecording() {
        if (isRecording) {
            recognition?.stop();
            return;
        }

        // Map short code to BCP-47
        const langMap = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
        const lang = langMap[getLang()] || 'pt-BR';

        recognition = new SpeechRecognition();
        recognition.lang            = lang;
        recognition.interimResults  = true;
        recognition.maxAlternatives = 1;
        recognition.continuous      = false;

        isRecording = true;
        btnEl.classList.add('mic-recording');
        btnEl.title = 'Gravando… clique para parar';

        recognition.onresult = (e) => {
            let interim = '';
            let final   = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) final += t;
                else                       interim += t;
            }
            // Show interim result visually (dim style)
            if (final) {
                inputEl.value = (inputEl.value + ' ' + final).trim();
            }
        };

        recognition.onerror = (e) => {
            console.warn('[VoiceInput] Error:', e.error);
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
        };

        recognition.start();
    }

    function stopRecording() {
        isRecording = false;
        btnEl.classList.remove('mic-recording');
        btnEl.title = 'Clique para falar';
        recognition = null;
    }

    btnEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startRecording();
    });
}
