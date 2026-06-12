export const state = {
    isSpeaking3D: false,
    currentType: 'theme', // theme, text, pdf
    selectedPdfFile: null,
    lessonData: null, // Generated classroom data
    currentSlideIdx: 0,
    audioDuration: 0,
    audioLoading: false,
    autoPlayEnabled: localStorage.getItem('classroom_autoplay') !== 'false',
    wordRanges: [],
    isPlaying: false,
    animationFrameId: null,
    explanationActive: false,
    imageMode: localStorage.getItem('classroom_image_mode') || 'split',
    animationStyle: localStorage.getItem('classroom_animation_style') || 'none'
};

