// classroom/exporter.js — screen recording / video export for classroom
import { state } from './state.js';
import { elements } from './elements.js';
import { loadSlide } from './player.js';
import { updateAutoPlayUI } from './player.js';

/**
 * Sets up the video export button for the classroom stage.
 * Must be called after DOM is ready.
 */
export function setupClassroomExporter() {
    if (!elements.btnExportVideo) return;

    let mediaRecorder;
    let recordedChunks = [];
    let stopCheckInterval;

    elements.btnExportVideo.addEventListener('click', async () => {
        if (!state.lessonData) {
            alert('Nenhuma aula carregada para gravar.');
            return;
        }

        try {
            // 1. Request Display Media
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" },
                audio: true,
                preferCurrentTab: true
            });

            // 2. Fullscreen the classroom board area and hide controls
            const videoArea = document.querySelector('.classroom-board-area');
            if (videoArea.requestFullscreen) {
                await videoArea.requestFullscreen();
            }
            videoArea.style.cursor = 'none';
            videoArea.classList.add('recording-mode');

            // 3. Capture audio via Web Audio API for reliable sync
            let audioTrack = null;
            try {
                if (!window._classroomAudioDest) {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const source = audioCtx.createMediaElementSource(elements.audioEl);
                    const dest = audioCtx.createMediaStreamDestination();
                    source.connect(dest);
                    source.connect(audioCtx.destination);
                    window._classroomAudioDest = dest;
                }
                audioTrack = window._classroomAudioDest.stream.getAudioTracks()[0];
            } catch (e) {
                console.warn("WebAudio capture failed, falling back to system audio", e);
                audioTrack = stream.getAudioTracks()[0];
            }

            let finalStream;
            let canvasAnimFrame = null;
            let recordVideoEl = null;
            let canvasStream = null;

            const isStories = state.lessonData.output_format === 'stories';
            if (isStories) {
                videoArea.classList.add('stories-mode');
            } else {
                videoArea.classList.remove('stories-mode');
            }

            if (isStories) {
                // Stories Mode: Crop the center 9:16 region
                recordVideoEl = document.createElement('video');
                recordVideoEl.srcObject = stream;
                recordVideoEl.autoplay = true;
                recordVideoEl.playsInline = true;
                recordVideoEl.muted = true;
                
                // Wait for the video metadata to load so we know its width/height
                await new Promise((resolve) => {
                    recordVideoEl.onloadedmetadata = resolve;
                });
                await recordVideoEl.play();

                const canvas = document.createElement('canvas');
                canvas.width = 720;
                canvas.height = 1280;
                const ctx = canvas.getContext('2d');

                const drawFrame = () => {
                    if (recordVideoEl.paused || recordVideoEl.ended) return;

                    const videoWidth = recordVideoEl.videoWidth;
                    const videoHeight = recordVideoEl.videoHeight;

                    // Crop 9:16 area from the center of the video stream
                    const sourceHeight = videoHeight;
                    const sourceWidth = videoHeight * (9 / 16);
                    const sourceX = (videoWidth - sourceWidth) / 2;
                    const sourceY = 0;

                    ctx.drawImage(recordVideoEl, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
                    canvasAnimFrame = requestAnimationFrame(drawFrame);
                };

                drawFrame();

                canvasStream = canvas.captureStream(30);
                const croppedVideoTrack = canvasStream.getVideoTracks()[0];
                
                const tracks = [croppedVideoTrack];
                if (audioTrack) tracks.push(audioTrack);
                finalStream = new MediaStream(tracks);
            } else {
                const tracks = [stream.getVideoTracks()[0]];
                if (audioTrack) tracks.push(audioTrack);
                finalStream = new MediaStream(tracks);
            }

            recordedChunks = [];
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
            mediaRecorder = new MediaRecorder(finalStream, { mimeType });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunks.push(event.data);
            };

            const lblExport = document.getElementById('lbl-btn-export');

            const restoreUI = () => {
                if (document.fullscreenElement) document.exitFullscreen();
                videoArea.style.cursor = 'default';
                videoArea.classList.remove('recording-mode');
                
                const originallyStories = state.lessonData.output_format === 'stories';
                const stage = elements.stagePanel;
                const blackboard = document.querySelector('.blackboard');
                if (originallyStories) {
                    if (stage) stage.classList.add('stories-mode');
                    if (blackboard) blackboard.classList.add('stories-mode');
                    videoArea.classList.add('stories-mode');
                } else {
                    if (stage) stage.classList.remove('stories-mode');
                    if (blackboard) blackboard.classList.remove('stories-mode');
                    videoArea.classList.remove('stories-mode');
                }

                elements.exportStatus.style.display = 'none';
                elements.btnExportVideo.disabled = false;
                if (lblExport) lblExport.textContent = 'Gravar Aula';
                if (stopCheckInterval) clearInterval(stopCheckInterval);
                if (canvasAnimFrame) cancelAnimationFrame(canvasAnimFrame);
                if (recordVideoEl) {
                    recordVideoEl.pause();
                    recordVideoEl.srcObject = null;
                }

                stream.getTracks().forEach(t => t.stop());
                if (canvasStream) canvasStream.getTracks().forEach(t => t.stop());
            };

            mediaRecorder.onstop = () => {
                restoreUI();
                const blob = new Blob(recordedChunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                const safeTitle = (state.lessonData.subject || 'aula').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                a.download = `${safeTitle}.webm`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            };

            // Wait for fullscreen animation to settle
            await new Promise(r => setTimeout(r, 1000));

            elements.btnExportVideo.disabled = true;
            if (lblExport) lblExport.textContent = 'Gravando...';
            elements.exportStatus.style.display = 'block';
            mediaRecorder.start();

            // Restart from slide 0 with autoplay enabled
            state.autoPlayEnabled = true;
            localStorage.setItem('classroom_autoplay', state.autoPlayEnabled);
            updateAutoPlayUI();

            state.currentSlideIdx = 0;
            loadSlide(0);
            setTimeout(() => {
                if (elements.audioEl.paused) elements.btnPlay.click();
            }, 800);

            // Stop when user ends screen share
            stream.getVideoTracks()[0].onended = () => {
                if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            };

            // Auto-stop when last slide finishes
            stopCheckInterval = setInterval(() => {
                if (state.currentSlideIdx >= state.lessonData.slides.length - 1) {
                    if (!state.isPlaying && elements.audioEl.paused && !state.audioLoading && elements.audioEl.currentTime > 0.5) {
                        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                        clearInterval(stopCheckInterval);
                    }
                }
            }, 1000);

        } catch (err) {
            console.error("Error starting screen record:", err);
            alert("Falha ao iniciar a gravação. Verifique as permissões no navegador.");
            elements.exportStatus.style.display = 'none';
            elements.btnExportVideo.disabled = false;
            const lblExport = document.getElementById('lbl-btn-export');
            if (lblExport) lblExport.textContent = 'Gravar Aula';
        }
    });
}
