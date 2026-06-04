import { elements } from './elements.js';

export function initializeAvatarHandlers() {
    // Load persisted avatar name and image from localStorage
    const savedName = localStorage.getItem('classroom_avatar_name');
    if (savedName) {
        elements.roleNameEl.textContent = savedName;
    }

    const savedImg = localStorage.getItem('classroom_avatar_image');
    if (savedImg) {
        elements.avatarDisplayImg.src = savedImg;
    }

    // Save name on blur/lose focus
    elements.roleNameEl.addEventListener('blur', () => {
        const newName = elements.roleNameEl.textContent.trim();
        if (newName) {
            localStorage.setItem('classroom_avatar_name', newName);
        } else {
            elements.roleNameEl.textContent = 'Professor IA';
        }
    });

    // Trigger blur when pressing Enter key on editable name
    elements.roleNameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.roleNameEl.blur();
        }
    });

    // Handle profile photo upload and convert to base64 DataURL
    elements.avatarUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                elements.avatarDisplayImg.src = dataUrl;
                localStorage.setItem('classroom_avatar_image', dataUrl);
            };
            reader.readAsDataURL(file);
        }
    });

    // ── Magnifying Glass Effect ──────────────────────────────────────────
    const LENS_SIZE = 220;     // diameter in px
    const ZOOM     = 2.8;      // magnification factor

    const lens = document.getElementById('magnifier-lens');

    function isImageReady() {
        return (
            elements.boardImage &&
            elements.boardImage.src &&
            !elements.boardImage.src.endsWith('/classroom') &&
            !elements.boardImage.className.includes('loading') &&
            elements.boardImage.complete &&
            elements.boardImage.naturalWidth > 0
        );
    }

    function updateLens(e) {
        if (!isImageReady()) return;

        const imgRect = elements.boardImage.getBoundingClientRect();

        // Cursor position relative to the image
        const cx = e.clientX - imgRect.left;
        const cy = e.clientY - imgRect.top;

        // Clamp so the zoomed region doesn't go outside the image
        const halfW = (LENS_SIZE / ZOOM) / 2;
        const halfH = (LENS_SIZE / ZOOM) / 2;
        const clampedX = Math.max(halfW, Math.min(cx, imgRect.width  - halfW));
        const clampedY = Math.max(halfH, Math.min(cy, imgRect.height - halfH));

        // Background size = image rendered size × zoom factor
        const bgW = imgRect.width  * ZOOM;
        const bgH = imgRect.height * ZOOM;

        // Background position: shifts so the point under cursor is centred in lens
        const bgX = -(clampedX * ZOOM - LENS_SIZE / 2);
        const bgY = -(clampedY * ZOOM - LENS_SIZE / 2);

        // Use a proxy URL if needed (same logic as player.js)
        let src = elements.boardImage.src;
        if (src.includes('/api/proxy-image')) {
            // already proxied
        } else if (src.includes('googleusercontent.com') || src.includes('google.com')) {
            src = `/api/proxy-image?url=${encodeURIComponent(src)}`;
        }

        lens.style.backgroundImage  = `url("${src}")`;
        lens.style.backgroundSize   = `${bgW}px ${bgH}px`;
        lens.style.backgroundPosition = `${bgX}px ${bgY}px`;

        // Position lens centred on cursor
        lens.style.left = `${e.clientX}px`;
        lens.style.top  = `${e.clientY}px`;
    }

    elements.boardImage.addEventListener('mouseenter', (e) => {
        if (!isImageReady()) return;
        lens.style.display = 'block';
        elements.boardImage.classList.add('magnifying');
        updateLens(e);
    });

    elements.boardImage.addEventListener('mousemove', updateLens);

    elements.boardImage.addEventListener('mouseleave', () => {
        lens.style.display = 'none';
        elements.boardImage.classList.remove('magnifying');
    });
}

