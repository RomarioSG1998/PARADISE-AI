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

    // ── Draggable Presenter Avatar ───────────────────────────────────────
    const container = document.querySelector('.blackboard .avatar-container');
    const blackboard = document.querySelector('.blackboard');

    if (container && blackboard) {
        // Prevent default drag behaviors
        container.addEventListener('dragstart', (e) => e.preventDefault());

        const startDrag = (e) => {
            // Do not drag if clicking text inputs, file selectors, editable fields, or the profile image button
            const isInteractive = e.target.closest('[contenteditable="true"], input, label, button, .teacher-avatar, i');
            if (isInteractive) return;

            e.preventDefault();

            const rect = container.getBoundingClientRect();
            const boardRect = blackboard.getBoundingClientRect();

            // Store starting positions
            const startX = e.clientX || (e.touches && e.touches[0].clientX);
            const startY = e.clientY || (e.touches && e.touches[0].clientY);

            // Compute current relative position to the blackboard parent
            const currentLeft = rect.left - boardRect.left;
            const currentTop = rect.top - boardRect.top;

            const onDrag = (moveEvent) => {
                const clientX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0].clientX);
                const clientY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0].clientY);

                const dx = clientX - startX;
                const dy = clientY - startY;

                let newLeft = currentLeft + dx;
                let newTop = currentTop + dy;

                // Restrict layout to stay strictly inside the blackboard borders (14px border)
                const borderOffset = 14;
                const maxLeft = boardRect.width - rect.width - borderOffset;
                const maxTop = boardRect.height - rect.height - borderOffset;

                newLeft = Math.max(borderOffset, Math.min(newLeft, maxLeft));
                newTop = Math.max(borderOffset, Math.min(newTop, maxTop));

                container.style.left = `${newLeft}px`;
                container.style.top = `${newTop}px`;
                container.style.bottom = 'auto';
                container.style.right = 'auto';
            };

            const stopDrag = () => {
                document.removeEventListener('mousemove', onDrag);
                document.removeEventListener('mouseup', stopDrag);
                document.removeEventListener('touchmove', onDrag);
                document.removeEventListener('touchend', stopDrag);
            };

            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchmove', onDrag, { passive: false });
            document.addEventListener('touchend', stopDrag);
        };

        // Attach both mouse and touch events
        container.addEventListener('mousedown', startDrag);
        container.addEventListener('touchstart', startDrag, { passive: false });
    }
}

