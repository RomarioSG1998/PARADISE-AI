/**
 * voice_input.js — Shared voice-to-text helper.
 * Uses the Web Speech API (SpeechRecognition). Works in Chrome/Edge.
 * Falls back gracefully on unsupported browsers.
 */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Attach a voice-input mic button to a text input/textarea.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} inputEl  — the target field
 * @param {HTMLButtonElement}                   btnEl    — the mic button
 * @param {Function}                            getLang  — callback returning language BCP-47 / short code
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

        // Map short code/name to BCP-47
        const currentLanguage = typeof getLang === 'function' ? getLang() : getLang;
        const langMap = { 
            pt: 'pt-BR', 'Português': 'pt-BR', 'português': 'pt-BR',
            en: 'en-US', 'Inglês': 'en-US', 'inglês': 'en-US',
            es: 'es-ES', 'Espanhol': 'es-ES', 'espanhol': 'es-ES'
        };
        const lang = langMap[currentLanguage] || 'pt-BR';

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
            if (final) {
                inputEl.value = (inputEl.value + ' ' + final).trim();
                // Dispatch input event so validation checks are triggered
                inputEl.dispatchEvent(new Event('input'));
                inputEl.dispatchEvent(new Event('change'));
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
