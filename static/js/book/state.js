export const state = {
    currentBook: null,
    currentChapterIndex: 0,
    autoPlayEnabled: localStorage.getItem('book_autoplay') !== 'false',
    imageMode: localStorage.getItem('book_image_mode') || 'split',
    activeParagraphElement: null,
    speakingParagraphsQueue: [],
    currentSpeakingQueueIndex: 0,
    currentUtterance: null
};
