export const state = {
    currentBook: null,
    currentChapterIndex: 0,
    autoPlayEnabled: localStorage.getItem('book_autoplay') !== 'false',
    activeParagraphElement: null,
    speakingParagraphsQueue: [],
    currentSpeakingQueueIndex: 0,
    currentUtterance: null
};
