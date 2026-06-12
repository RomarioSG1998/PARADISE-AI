// narrative/dom.js — cached DOM element references
export const dom = {
    setupPanel: document.getElementById('setup-panel'),
    loadingPanel: document.getElementById('loading-panel'),
    theaterArena: document.getElementById('theater-arena'),
    btnToggleSubtitles: document.getElementById('btn-toggle-subtitles'),
    subtitleStyleSelect: document.getElementById('subtitle-style-select'),
    subtitleOverlay: document.querySelector('.subtitle-overlay'),
    historyPanel: document.getElementById('history-panel'),
    historyList: document.getElementById('history-list'),
    historyTitleLabel: document.getElementById('history-title-label'),

    themeInput: document.getElementById('theme-input'),
    textInput: document.getElementById('text-input'),
    pdfFileInput: document.getElementById('pdf-file-input'),
    selectedFilename: document.getElementById('selected-filename'),
    pdfDropZone: document.getElementById('pdf-drop-zone'),

    genreSelect: document.getElementById('genre-select'),
    visualThemeSelect: document.getElementById('narrative-visual-theme'),
    durationSelect: document.getElementById('duration-select'),
    voiceSelect: document.getElementById('voice-select'),

    btnGenerate: document.getElementById('btn-generate-narrative'),
    btnNewStory: document.getElementById('btn-new-story'),

    btnMicTheme: document.getElementById('btn-mic-theme'),
    btnMicText: document.getElementById('btn-mic-text'),

    storyTitle: document.getElementById('story-title'),
    storyBadge: document.getElementById('story-badge'),
    screenImage: document.getElementById('screen-image'),
    screenBackplate: document.getElementById('screen-backplate'),
    subtitleText: document.getElementById('subtitle-text'),
    ambientLayer: document.getElementById('ambient-layer'),

    btnPrev: document.getElementById('btn-prev'),
    btnPlay: document.getElementById('btn-play'),
    btnNext: document.getElementById('btn-next'),
    voiceWave: document.getElementById('voice-wave'),

    currentTime: document.getElementById('current-time'),
    totalTime: document.getElementById('total-time'),
    timelineSlider: document.getElementById('timeline-slider'),

    volumeSlider: document.getElementById('volume-slider'),
    volumeIcon: document.getElementById('volume-icon'),
    speedSelect: document.getElementById('speed-select'),
    sceneCounter: document.getElementById('scene-counter'),
    scenesList: document.getElementById('scenes-list'),

    audioEl: document.getElementById('narrative-audio'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    theaterScreen: document.querySelector('.theater-screen'),

    loadingStepTitle: document.getElementById('loading-step-title'),
    loadingStepDesc: document.getElementById('loading-step-desc'),

    thumbnailImg: document.getElementById('thumbnail-img'),
    thumbnailPlaceholder: document.getElementById('thumbnail-placeholder'),
    btnDownloadThumbnail: document.getElementById('btn-download-thumbnail'),
    btnChangeThumbnail: document.getElementById('btn-change-thumbnail'),
    horrorEffectSelect: document.getElementById('horror-effect-select'),
    horrorOverlay: document.getElementById('horror-overlay'),
    imageAnimationSelect: document.getElementById('image-animation-select'),
    formatBtnYoutube: document.getElementById('format-btn-youtube'),
    formatBtnStories: document.getElementById('format-btn-stories'),
    generateBtnLabel: document.getElementById('generate-btn-label'),
    btnExportVideo: document.getElementById('btn-export-video'),
    exportStatus: document.getElementById('export-status'),
    btnPreviewVoice: document.getElementById('btn-preview-voice')
};
