// narrative/thumbnail.js — YouTube thumbnail UI management
import { state } from './state.js';
import { dom } from './dom.js';
import { saveNarrativeToHistory } from './history.js';
// composeThumbnailWithTitle lives in shared; re-exported for any external importers
export { composeThumbnailWithTitle } from '../shared/thumbnail.js';
import { composeThumbnailWithTitle as _compose, composeVerticalThumbnailWithTitle as _composeVertical } from '../shared/thumbnail.js';

export function updateThumbnailUI() {
    if (!dom.thumbnailImg || !dom.thumbnailPlaceholder) return;

    // Update title label based on current format and language
    const lang = localStorage.getItem('paradise_language') || 'pt';
    const isStories = state.outputFormat === 'stories';
    const thumbTitleLabel = document.getElementById('thumbnail-title-label');
    if (thumbTitleLabel) {
        thumbTitleLabel.textContent = isStories 
            ? (lang === 'en' ? 'Stories Cover' : lang === 'es' ? 'Portada de Stories' : 'Capa do Stories')
            : (lang === 'en' ? 'YouTube Thumbnail' : lang === 'es' ? 'Miniatura de YouTube' : 'Thumbnail do YouTube');
    }

    // Update thumbnail container aspect ratio class
    const thumbContainer = document.querySelector('.thumbnail-container');
    if (thumbContainer) {
        if (isStories) {
            thumbContainer.style.aspectRatio = '9/16';
        } else {
            thumbContainer.style.aspectRatio = '16/9';
        }
    }

    if (dom.btnDownloadThumbnail) {
        dom.btnDownloadThumbnail.innerHTML = `<i class="fa-solid fa-download"></i> ` + 
            (lang === 'en' ? 'Download' : lang === 'es' ? 'Descargar' : 'Baixar');
    }
    if (dom.btnChangeThumbnail) {
        dom.btnChangeThumbnail.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ` + 
            (lang === 'en' ? 'Change' : lang === 'es' ? 'Cambiar' : 'Mudar');
    }

    if (state.narrativeData && state.narrativeData.thumbnail_url) {
        let rawUrl = state.narrativeData.thumbnail_url;
        let proxyUrl = rawUrl;
        if (rawUrl && (rawUrl.includes("googleusercontent.com") || rawUrl.includes("google.com"))) {
            proxyUrl = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
        }

        const title = (state.narrativeData.title || '').trim();
        const composeFn = isStories ? _composeVertical : _compose;
        composeFn(proxyUrl, title)
            .then(dataUrl => {
                state._composedThumbnailDataUrl = dataUrl;
                dom.thumbnailImg.src = dataUrl;
                dom.thumbnailImg.style.display = 'block';
                dom.thumbnailPlaceholder.style.display = 'none';
                if (dom.btnDownloadThumbnail) dom.btnDownloadThumbnail.disabled = false;
            })
            .catch(() => {
                dom.thumbnailImg.src = proxyUrl;
                dom.thumbnailImg.style.display = 'block';
                dom.thumbnailPlaceholder.style.display = 'none';
                if (dom.btnDownloadThumbnail) dom.btnDownloadThumbnail.disabled = false;
            });
    } else {
        resetThumbnailUI();
    }
}

export function resetThumbnailUI() {
    if (dom.thumbnailImg) {
        dom.thumbnailImg.src = '';
        dom.thumbnailImg.style.display = 'none';
    }
    if (dom.thumbnailPlaceholder) {
        dom.thumbnailPlaceholder.style.display = 'flex';
        const lang = localStorage.getItem('paradise_language');
        dom.thumbnailPlaceholder.textContent =
            lang === 'en' ? "No Thumbnail" :
            lang === 'es' ? "Sin Miniatura" :
                            "Sem Thumbnail";
    }
    if (dom.btnDownloadThumbnail) dom.btnDownloadThumbnail.disabled = true;
    state._composedThumbnailDataUrl = null;
}

/**
 * Binds the download and change thumbnail buttons.
 * Must be called after DOM is ready.
 */
export function setupThumbnailEvents() {
    if (dom.btnChangeThumbnail) {
        dom.btnChangeThumbnail.addEventListener('click', async () => {
            const isStories = state.outputFormat === 'stories';
            const msgPt = isStories 
                ? "Digite as instruções/prompt para a nova Capa do Stories (ou deixe em branco para regenerar baseado no título):" 
                : "Digite as instruções/prompt para a nova Thumbnail do YouTube (ou deixe em branco para regenerar baseado no título):";
            const msgEn = isStories 
                ? "Enter instructions/prompt for the new Stories Cover (or leave blank to regenerate based on story title):" 
                : "Enter instructions/prompt for the new YouTube thumbnail (or leave blank to regenerate based on story title):";
            const msgEs = isStories 
                ? "Ingrese instrucciones/prompt para la nueva portada de Stories (o deje en blanco para regenerar según el título):" 
                : "Ingrese instrucciones/prompt para la nueva miniatura de YouTube (o deje en blanco para regenerar según el título):";

            const customPrompt = prompt(
                localStorage.getItem('paradise_language') === 'en' ? msgEn :
                localStorage.getItem('paradise_language') === 'es' ? msgEs : msgPt
            );
            if (customPrompt === null) return;

            dom.thumbnailPlaceholder.style.display = 'flex';
            dom.thumbnailPlaceholder.textContent =
                localStorage.getItem('paradise_language') === 'en' ? "Generating..." :
                localStorage.getItem('paradise_language') === 'es' ? "Generando..." : "Gerando...";
            dom.thumbnailImg.style.display = 'none';
            dom.btnChangeThumbnail.disabled = true;
            dom.btnDownloadThumbnail.disabled = true;

            try {
                const res = await fetch('/api/narrative/regenerate-thumbnail', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: state.narrativeData.title,
                        genre: state.narrativeData.genre || 'fantasia',
                        visual_theme: state.narrativeData.visual_theme || (dom.visualThemeSelect ? dom.visualThemeSelect.value : 'classic'),
                        custom_prompt: customPrompt,
                        thumbnail_prompt: state.narrativeData.thumbnail_prompt || ''
                    })
                });
                const data = await res.json();
                if (data.thumbnail_url) {
                    state.narrativeData.thumbnail_url = data.thumbnail_url;
                    updateThumbnailUI();
                    saveNarrativeToHistory(state.narrativeData);
                } else {
                    alert("Erro: " + (data.error || "Nenhuma URL retornada"));
                    resetThumbnailUI();
                }
            } catch (err) {
                console.error("Error regenerating thumbnail:", err);
                alert("Erro ao regenerar thumbnail.");
                resetThumbnailUI();
            } finally {
                dom.btnChangeThumbnail.disabled = false;
            }
        });
    }

    if (dom.btnDownloadThumbnail) {
        dom.btnDownloadThumbnail.addEventListener('click', () => {
            const dataUrl = state._composedThumbnailDataUrl;
            if (dataUrl) {
                const a = document.createElement('a');
                a.href = dataUrl;
                const safeTitle = (state.narrativeData?.title || 'thumbnail')
                    .replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60);
                a.download = `${safeTitle}_thumbnail.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else if (state.narrativeData && state.narrativeData.thumbnail_url) {
                let downloadUrl = state.narrativeData.thumbnail_url;
                if (downloadUrl.includes("googleusercontent.com") || downloadUrl.includes("google.com")) {
                    downloadUrl = `/api/proxy-image?url=${encodeURIComponent(downloadUrl)}`;
                }
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = 'youtube-thumbnail.jpg';
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        });
    }
}
