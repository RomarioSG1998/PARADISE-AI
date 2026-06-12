// narrative/state.js — shared mutable state
export const state = {
    currentType: 'theme',
    selectedPdfFile: null,
    isPlaying: false,
    currentSceneIdx: 0,
    narrativeData: null,
    audioLoading: false,
    wordRanges: [],
    animationFrameId: null,
    autoPlayEnabled: true,
    subtitlesVisible: true,
    currentSubtitleStyle: 'classic',
    outputFormat: 'youtube',   // 'youtube' | 'stories'
    // Audio preload cache: Map<segmentIndex, HTMLAudioElement>
    audioCache: new Map(),
    // Image preload cache: Map<segmentIndex, HTMLImageElement (fully loaded)>
    imageCache: new Map(),
    _composedThumbnailDataUrl: null
};
