// narrative/exporter.js — screen recording / video export logic
import { state } from './state.js';
import { dom } from './dom.js';
import { loadScene } from './player.js';

/**
 * Sets up the video export button for the narrative theater.
 * Must be called after DOM is ready.
 */
export function setupExporter() {
    if (!dom.btnExportVideo) return;

    let mediaRecorder;
    let recordedChunks = [];
    let stopCheckInterval;
    let canvasAnimFrame = null;
    let recordVideoEl = null;
    let canvasStream = null;

    dom.btnExportVideo.addEventListener('click', async () => {
        if (!state.narrativeData) {
            alert('Nenhuma narrativa carregada para gravar.');
            return;
        }

        try {
            // 1. Request Display Media (preferCurrentTab guides user to pick current tab)
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" },
                audio: true,
                preferCurrentTab: true
            });

            // 2. Fullscreen the theater screen
            const videoArea = document.querySelector('.theater-screen');
            if (videoArea.requestFullscreen) {
                await videoArea.requestFullscreen();
            }
            videoArea.style.cursor = 'none';
            const controls = videoArea.querySelector('.media-controls');
            if (controls) controls.style.display = 'none';

            // 3. Capture audio via Web Audio API for reliable sync
            let audioTrack = null;
            try {
                if (!window._narrativeAudioDest) {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const source = audioCtx.createMediaElementSource(dom.audioEl);
                    const dest = audioCtx.createMediaStreamDestination();
                    source.connect(dest);
                    source.connect(audioCtx.destination);
                    window._narrativeAudioDest = dest;
                }
                audioTrack = window._narrativeAudioDest.stream.getAudioTracks()[0];
            } catch (e) {
                console.warn("WebAudio capture failed, falling back to system audio", e);
                audioTrack = stream.getAudioTracks()[0];
            }

            const videoTrack = stream.getVideoTracks()[0];
            let finalStream;

            if (state.outputFormat === 'stories') {
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
                // Standard vertical stories resolution (720x1280)
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
                // YouTube Mode: Widescreen 16:9, record directly
                const tracks = [videoTrack];
                if (audioTrack) tracks.push(audioTrack);
                finalStream = new MediaStream(tracks);
            }

            recordedChunks = [];
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
            mediaRecorder = new MediaRecorder(finalStream, { mimeType });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunks.push(event.data);
            };

            const restoreUI = () => {
                if (document.fullscreenElement) document.exitFullscreen();
                videoArea.style.cursor = 'default';
                if (controls) controls.style.display = '';

                dom.exportStatus.style.display = 'none';
                dom.btnExportVideo.disabled = false;
                const lang = localStorage.getItem('paradise_language') || 'pt';
                
                dom.btnExportVideo.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> ' + 
                    (lang === 'en' ? 'Start Recording' : lang === 'es' ? 'Iniciar Grabación' : 'Iniciar Gravação');
                
                if (stopCheckInterval) clearInterval(stopCheckInterval);

                if (canvasAnimFrame) {
                    cancelAnimationFrame(canvasAnimFrame);
                    canvasAnimFrame = null;
                }
                if (recordVideoEl) {
                    recordVideoEl.pause();
                    recordVideoEl.srcObject = null;
                    recordVideoEl = null;
                }
                if (canvasStream) {
                    canvasStream.getTracks().forEach(t => t.stop());
                    canvasStream = null;
                }

                stream.getTracks().forEach(t => t.stop());
            };

            mediaRecorder.onstop = () => {
                restoreUI();
                const blob = new Blob(recordedChunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                const safeTitle = (state.narrativeData.title || 'narrativa').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                a.download = `${safeTitle}.webm`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            };

            // 4. Wait for fullscreen animation
            await new Promise(r => setTimeout(r, 1000));

            dom.btnExportVideo.disabled = true;
            dom.btnExportVideo.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + 
                (localStorage.getItem('paradise_language') === 'en' ? 'Recording...' : 
                 localStorage.getItem('paradise_language') === 'es' ? 'Grabando...' : 'Gravando...');
            dom.exportStatus.style.display = 'block';
            mediaRecorder.start();

            // 5. Restart from scene 0
            loadScene(0);
            setTimeout(() => {
                if (dom.audioEl.paused) dom.btnPlay.click();
            }, 800);

            // 6. Stop when user ends screen share
            stream.getVideoTracks()[0].onended = () => {
                if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            };

            // 7. Auto-stop when last scene finishes
            stopCheckInterval = setInterval(() => {
                if (state.currentSceneIdx >= state.narrativeData.segments.length - 1) {
                    if (!state.isPlaying && dom.audioEl.paused && !state.audioLoading && dom.audioEl.currentTime > 0.5) {
                        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                        clearInterval(stopCheckInterval);
                    }
                }
            }, 1000);

        } catch (err) {
            console.error("Error starting screen record:", err);
            alert("Falha ao iniciar a gravação. Verifique as permissões no navegador.");
            dom.exportStatus.style.display = 'none';
            dom.btnExportVideo.disabled = false;
            dom.btnExportVideo.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> ' + 
                (localStorage.getItem('paradise_language') === 'en' ? 'Start Recording' : 
                 localStorage.getItem('paradise_language') === 'es' ? 'Iniciar Grabación' : 'Iniciar Gravação');
        }
    });
}
