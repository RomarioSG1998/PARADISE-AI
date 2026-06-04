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

    // Fullscreen Board Image Hover Zoom Event Listeners
    elements.boardImage.addEventListener('mouseenter', () => {
        // Only trigger if image is loaded and is not a blank slide
        if (elements.boardImage.src && !elements.boardImage.src.endsWith('/classroom') && elements.boardImage.style.display !== 'none' && !elements.boardImage.className.includes('loading')) {
            elements.fsOverlayImg.src = elements.boardImage.src;
            elements.fsOverlay.classList.add('active');
        }
    });

    elements.fsOverlay.addEventListener('mousemove', (e) => {
        const rect = elements.fsOverlayImg.getBoundingClientRect();
        // Close if mouse moves outside the bounds of the image (plus 20px padding buffer)
        if (
            e.clientX < rect.left - 20 ||
            e.clientX > rect.right + 20 ||
            e.clientY < rect.top - 20 ||
            e.clientY > rect.bottom + 20
        ) {
            elements.fsOverlay.classList.remove('active');
        }
    });

    // Allow closing by clicking anywhere on the overlay
    elements.fsOverlay.addEventListener('click', () => {
        elements.fsOverlay.classList.remove('active');
    });
}
