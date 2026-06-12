/* =========================================================================
   writer/dragdrop.js — Drag-and-drop file upload overlay + parallel uploads
   ========================================================================= */
import { state } from './state.js';
import { loadMaterials, loadProductionContext } from './workspaces.js';

export function setupDragAndDrop() {
    const dragDropOverlay = document.getElementById('drag-drop-overlay');
    const dragDropCancelBtn = document.getElementById('drag-drop-cancel-btn');
    const dropZones = document.querySelectorAll('.drop-zone');

    let dragCounter = 0;

    const showOverlay = () => { if (dragDropOverlay) dragDropOverlay.style.display = 'flex'; };
    const hideOverlay = () => { dragCounter = 0; if (dragDropOverlay) dragDropOverlay.style.display = 'none'; };

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (!state.currentEnvId) return;
        if (e.dataTransfer?.types.includes('Files')) {
            dragCounter++;
            if (dragCounter === 1) showOverlay();
        }
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!state.currentEnvId) return;
        dragCounter--;
        if (dragCounter <= 0) hideOverlay();
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        hideOverlay();
    });

    if (dragDropCancelBtn) dragDropCancelBtn.addEventListener('click', hideOverlay);
    if (dragDropOverlay) {
        dragDropOverlay.addEventListener('click', (e) => {
            if (e.target === dragDropOverlay) hideOverlay();
        });
    }

    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-active'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-active'));

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-active');
            hideOverlay();
            if (!state.currentEnvId) { alert('Selecione um Ambiente primeiro.'); return; }
            const files = e.dataTransfer.files;
            if (files.length === 0) return;
            await handleMultipleFilesUpload(files, zone.getAttribute('data-type'));
        });

        // Click-to-browse fallback
        zone.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.pdf,.txt';
            input.onchange = async (e) => {
                const files = e.target.files;
                if (files.length > 0) await handleMultipleFilesUpload(files, zone.getAttribute('data-type'));
            };
            input.click();
        });
    });
}

export async function handleMultipleFilesUpload(files, materialType) {
    const uploadStatusOverlay = document.getElementById('upload-status-overlay');
    const uploadFileList = document.getElementById('upload-file-list');
    if (!uploadStatusOverlay || !uploadFileList) return;

    uploadFileList.innerHTML = '';
    uploadStatusOverlay.style.display = 'flex';

    const filesArray = Array.from(files);
    const fileTasks = filesArray.map((file, index) => {
        const row = document.createElement('div');
        row.className = 'upload-file-row';
        row.id = `upload-file-${index}`;
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        row.innerHTML = `
            <div class="upload-file-info">
                <i class="${isPdf ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-lines'}"></i>
                <span class="upload-file-name" title="${file.name}">${file.name}</span>
            </div>
            <div class="upload-file-status pending"><i class="fa-solid fa-clock"></i> Pendente</div>
        `;
        uploadFileList.appendChild(row);

        return (async () => {
            const statusDiv = row.querySelector('.upload-file-status');
            statusDiv.className = 'upload-file-status uploading';
            statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

            const formData = new FormData();
            let url;
            if (materialType === 'context') {
                url = `/api/writer/environments/${state.currentEnvId}/contexts`;
                formData.append('name', file.name);
                formData.append('file', file);
            } else {
                url = `/api/writer/environments/${state.currentEnvId}/materials`;
                formData.append('material_type', materialType);
                formData.append('name', file.name);
                formData.append('file', file);
            }

            try {
                const res = await fetch(url, { method: 'POST', body: formData });
                const data = await res.json();
                if (res.ok && data.success) {
                    statusDiv.className = 'upload-file-status success';
                    statusDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i> Concluído';
                } else {
                    statusDiv.className = 'upload-file-status error';
                    statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${data.error || 'Erro'}`;
                }
            } catch {
                statusDiv.className = 'upload-file-status error';
                statusDiv.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Erro de Conexão';
            }
        })();
    });

    await Promise.all(fileTasks);
    await loadMaterials();
    await loadProductionContext();

    // Fade out the overlay after 2s
    setTimeout(() => {
        uploadStatusOverlay.style.transition = 'opacity 0.5s ease';
        uploadStatusOverlay.style.opacity = '0';
        setTimeout(() => {
            uploadStatusOverlay.style.display = 'none';
            uploadStatusOverlay.style.opacity = '1';
            uploadStatusOverlay.style.transition = '';
        }, 500);
    }, 2000);
}
