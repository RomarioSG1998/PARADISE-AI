/* =========================================================================
   writer/ui.js — Toast notifications, modals, markdown formatter, diff engine
   ========================================================================= */

export function showToast(title, body, onClickCallback) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-card';
    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid fa-robot"></i></div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-body">${body}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;

    toast.addEventListener('click', (e) => {
        if (e.target.classList.contains('toast-close')) return;
        if (onClickCallback) onClickCallback();
        removeToast(toast);
    });
    toast.querySelector('.toast-close').addEventListener('click', (e) => {
        e.stopPropagation();
        removeToast(toast);
    });

    container.appendChild(toast);
    setTimeout(() => removeToast(toast), 6000);
}

export function removeToast(toast) {
    if (toast.classList.contains('toast-fadeOut')) return;
    toast.classList.add('toast-fadeOut');
    setTimeout(() => toast.remove(), 350);
}

export function openWriterModal(id) {
    document.getElementById(id).classList.add('active');
}

export function closeWriterModal(id) {
    document.getElementById(id).classList.remove('active');
}

export function formatMarkdownSimple(text) {
    if (!text) return '';
    let html = text;

    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/```([\s\S]+?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    html = html.split('\n\n').map(p => {
        p = p.trim();
        if (p.startsWith('- ') || p.startsWith('* ')) {
            const items = p.split(/\n[-*]\s/).map(li => {
                let liText = li.replace(/^[-*]\s/, '');
                if (liText.includes('[CORRETO]') || liText.includes('[CORRECT]')) {
                    liText = liText.replace('[CORRETO]', '').replace('[CORRECT]', '');
                    return `<li class="correct-highlight" style="list-style-type:none;margin-left:-20px;"><i class="fa-solid fa-circle-check" style="color:#22c55e;margin-right:6px;"></i>${liText}</li>`;
                }
                if (liText.includes('[INCORRETO]') || liText.includes('[INCORRECT]')) {
                    liText = liText.replace('[INCORRETO]', '').replace('[INCORRECT]', '');
                    return `<li class="incorrect-highlight" style="list-style-type:none;margin-left:-20px;"><i class="fa-solid fa-circle-xmark" style="color:#ef4444;margin-right:6px;"></i>${liText}</li>`;
                }
                return `<li>${liText}</li>`;
            }).join('');
            return `<ul>${items}</ul>`;
        }
        if (p.includes('[CORRETO]') || p.includes('[CORRECT]')) {
            const clean = p.replace('[CORRETO]', '').replace('[CORRECT]', '');
            return `<div class="correct-highlight"><i class="fa-solid fa-circle-check" style="color:#22c55e;margin-right:6px;"></i><strong>Correto:</strong> ${clean}</div>`;
        }
        if (p.includes('[INCORRETO]') || p.includes('[INCORRECT]')) {
            const clean = p.replace('[INCORRETO]', '').replace('[INCORRECT]', '');
            return `<div class="incorrect-highlight"><i class="fa-solid fa-circle-xmark" style="color:#ef4444;margin-right:6px;"></i><strong>Ajustar:</strong> ${clean}</div>`;
        }
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
}

export function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function generateLineDiff(originalHtml, proposedHtml) {
    function htmlToText(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        temp.querySelectorAll('p, div, br, li, h1, h2, h3, h4').forEach(b => {
            b.after('\n');
        });
        return temp.textContent.trim();
    }

    const origLines = htmlToText(originalHtml).split('\n').map(l => l.trim()).filter(Boolean);
    const propLines = htmlToText(proposedHtml).split('\n').map(l => l.trim()).filter(Boolean);

    let diffHtml = '';
    let i = 0, j = 0;
    while (i < origLines.length || j < propLines.length) {
        if (i < origLines.length && j < propLines.length && origLines[i] === propLines[j]) {
            diffHtml += `<div class="diff-line unchanged">  ${escapeHtml(origLines[i])}</div>`;
            i++; j++;
        } else {
            let foundInProp = -1;
            for (let k = j; k < Math.min(j + 8, propLines.length); k++) {
                if (origLines[i] === propLines[k]) { foundInProp = k; break; }
            }
            if (foundInProp !== -1) {
                for (let k = j; k < foundInProp; k++) {
                    diffHtml += `<div class="diff-line addition">+ ${escapeHtml(propLines[k])}</div>`;
                }
                j = foundInProp;
            } else {
                let foundInOrig = -1;
                for (let k = i; k < Math.min(i + 8, origLines.length); k++) {
                    if (propLines[j] === origLines[k]) { foundInOrig = k; break; }
                }
                if (foundInOrig !== -1) {
                    for (let k = i; k < foundInOrig; k++) {
                        diffHtml += `<div class="diff-line deletion">- ${escapeHtml(origLines[k])}</div>`;
                    }
                    i = foundInOrig;
                } else {
                    if (i < origLines.length) { diffHtml += `<div class="diff-line deletion">- ${escapeHtml(origLines[i])}</div>`; i++; }
                    if (j < propLines.length) { diffHtml += `<div class="diff-line addition">+ ${escapeHtml(propLines[j])}</div>`; j++; }
                }
            }
        }
    }
    return diffHtml;
}

export function initSpeechRecognition(buttonId, inputId) {
    const btn = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { btn.style.display = 'none'; return; }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    recognition.maxAlternatives = 1;

    let isRecording = false;
    let finalTranscript = '';
    let startInputValue = '';
    let selectionStartPos = 0;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isRecording) {
            recognition.stop();
        } else {
            finalTranscript = '';
            startInputValue = input.value;
            selectionStartPos = input.selectionStart || 0;
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isRecording = true;
        btn.classList.add('recording');
        btn.innerHTML = '<i class="fa-solid fa-microphone-lines fa-fade"></i>';
    };

    recognition.onend = async () => {
        isRecording = false;
        btn.classList.remove('recording');
        const textToCorrect = finalTranscript.trim();
        if (textToCorrect) {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles fa-spin" style="color:#c084fc;"></i>';
            try {
                const response = await fetch('/api/writer/correct-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: textToCorrect })
                });
                const data = await response.json();
                if (data.corrected_text) {
                    const before = startInputValue.substring(0, selectionStartPos);
                    const after = startInputValue.substring(selectionStartPos);
                    const sep = before && !before.endsWith(' ') ? ' ' : '';
                    input.value = before + sep + data.corrected_text + after;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } catch (err) {
                console.error('Speech correction error:', err);
            }
        }
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isRecording = false;
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        const textToInsert = (finalTranscript + interimTranscript).trim();
        if (textToInsert) {
            const before = startInputValue.substring(0, selectionStartPos);
            const after = startInputValue.substring(selectionStartPos);
            const sep = before && !before.endsWith(' ') ? ' ' : '';
            input.value = before + sep + textToInsert + after;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
}
