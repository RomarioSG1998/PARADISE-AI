/**
 * shared/thumbnail.js — Shared YouTube thumbnail canvas composer
 *
 * Used by: book/player.js, classroom/player.js, narrative/thumbnail.js
 *
 * Composes a 1280×720 JPEG thumbnail: background image + gradient overlay
 * + bold title text in YouTube style, returned as a data URL.
 *
 * @param {string} imgSrc - URL of the background image (proxy-safe)
 * @param {string} title  - Story/lesson title to overlay
 * @returns {Promise<string>} data URL (image/jpeg)
 */
export function composeThumbnailWithTitle(imgSrc, title) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const W = 1280, H = 720;
            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            // Background image
            ctx.drawImage(img, 0, 0, W, H);

            // Gradient overlay (bottom half) for text legibility
            const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(0.4, 'rgba(0,0,0,0.7)');
            grad.addColorStop(1, 'rgba(0,0,0,0.93)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Dynamic font sizing to fit title width
            const maxWidth = W - 80;
            const lineHeight = 84;
            let fontSize = 74;
            ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
            while (ctx.measureText(title).width > maxWidth && fontSize > 38) {
                fontSize -= 2;
                ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
            }

            // Word-wrap helper
            function wrapText(text, maxW) {
                const words = text.split(' ');
                const lines = [];
                let cur = '';
                for (const w of words) {
                    const test = cur ? cur + ' ' + w : w;
                    if (ctx.measureText(test).width > maxW && cur) {
                        lines.push(cur);
                        cur = w;
                    } else { cur = test; }
                }
                if (cur) lines.push(cur);
                return lines;
            }

            const lines = wrapText(title.toUpperCase(), maxWidth);
            const totalH = lines.length * lineHeight;
            let y = H - 44 - totalH + lineHeight;

            // Drop-shadow
            ctx.shadowColor = 'rgba(0,0,0,0.98)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 4;

            // Black stroke + white→yellow fill (YouTube style)
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = fontSize < 50 ? 6 : 9;
            ctx.lineJoin = 'round';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            const tGrad = ctx.createLinearGradient(0, y - lineHeight * 0.8, 0, y + totalH);
            tGrad.addColorStop(0, '#FFFFFF');
            tGrad.addColorStop(1, '#FFE033');

            for (const line of lines) {
                ctx.strokeText(line, 40, y);
                ctx.fillStyle = tGrad;
                ctx.fillText(line, 40, y);
                y += lineHeight;
            }

            ctx.shadowColor = 'transparent';
            resolve(canvas.toDataURL('image/jpeg', 0.93));
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = imgSrc;
    });
}
