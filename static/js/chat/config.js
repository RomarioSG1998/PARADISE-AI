import { state } from './state.js';
import { elements } from './elements.js';

export async function checkStatus() {
    if (!elements.statusDot || !elements.statusLabel) return;
    try {
        const resp = await fetch('/api/status');
        const data = await resp.json();
        
        state.isConfigured = data.configured;
        state.isActive = data.active;

        if (state.isActive) {
            elements.statusDot.className = 'dot active';
            elements.statusLabel.textContent = data.has_api_key ? 'Conectado (API Key Ativa)' : 'Conectado (Cookies Ativos)';
        } else if (state.isConfigured) {
            elements.statusDot.className = 'dot warning';
            elements.statusLabel.textContent = 'Configuração Salva (Inativo/Erro)';
        } else {
            elements.statusDot.className = 'dot';
            elements.statusLabel.textContent = 'Não configurado';
        }
    } catch (err) {
        elements.statusDot.className = 'dot';
        elements.statusLabel.textContent = 'Servidor Offline';
    }
}
