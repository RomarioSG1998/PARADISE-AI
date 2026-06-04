import { elements } from './elements.js';
import { bookTranslations } from './translations.js';

export async function checkStatus() {
    if (!elements.statusDot || !elements.statusLabel) return;
    try {
        const resp = await fetch('/api/status');
        const data = await resp.json();
        
        const isConfigured = data.configured;
        const isActive = data.active;

        if (isActive) {
            elements.statusDot.style.backgroundColor = '#10b981';
            elements.statusLabel.textContent = 'Conectado';
        } else if (isConfigured) {
            elements.statusDot.style.backgroundColor = '#f59e0b';
            elements.statusLabel.textContent = 'Inativo/Erro';
        } else {
            elements.statusDot.style.backgroundColor = '#ef4444';
            elements.statusLabel.textContent = 'Desconectado';
        }
    } catch (err) {
        elements.statusDot.style.backgroundColor = '#ef4444';
        elements.statusLabel.textContent = 'Offline';
    }
}
