// narrative/i18n.js — language updates for all UI text
import { dom } from './dom.js';
import { translations, getActiveLanguage } from './translations.js';

export function applyLanguageUpdates(lang) {
    localStorage.setItem('paradise_language', lang);
    document.cookie = `paradise_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;

    const t = translations[lang] || translations.pt;

    const backBtn = document.querySelector('.back-btn');
    if (backBtn) backBtn.innerHTML = lang === 'en' ? '<i class="fa-solid fa-arrow-left"></i> General Panel' :
                                     lang === 'es' ? '<i class="fa-solid fa-arrow-left"></i> Panel General' :
                                                     '<i class="fa-solid fa-arrow-left"></i> Painel Geral';

    const headerTitle = document.querySelector('.panel-header h2');
    if (headerTitle) headerTitle.textContent = lang === 'en' ? 'Narrator AI (Narrative AI)' :
                                               lang === 'es' ? 'Narrador AI (Narrativa AI)' :
                                                               'Narrativa AI (Narrator AI)';

    const headerDesc = document.querySelector('.panel-header p');
    if (headerDesc) headerDesc.textContent = lang === 'en' ? 'Create fascinating stories with professional dubbing and synchronized custom images.' :
                                             lang === 'es' ? 'Genera historias fascinantes con doblaje profesional e imágenes sincronizadas a medida.' :
                                                             'Gere histórias fascinantes com dublagem profissional e imagens sincronizadas sob medida.';

    const tabs = document.querySelectorAll('.type-tab');
    if (tabs.length >= 3) {
        tabs[0].innerHTML = lang === 'en' ? '<i class="fa-solid fa-lightbulb"></i> Theme/Idea' :
                            lang === 'es' ? '<i class="fa-solid fa-lightbulb"></i> Tema/Idea' :
                                            '<i class="fa-solid fa-lightbulb"></i> Tema/Ideia';
        tabs[1].innerHTML = lang === 'en' ? '<i class="fa-solid fa-align-left"></i> Full Text' :
                            lang === 'es' ? '<i class="fa-solid fa-align-left"></i> Texto Completo' :
                                            '<i class="fa-solid fa-align-left"></i> Texto Completo';
        tabs[2].innerHTML = lang === 'en' ? '<i class="fa-solid fa-file-pdf"></i> Upload PDF' :
                            lang === 'es' ? '<i class="fa-solid fa-file-pdf"></i> Subir PDF' :
                                            '<i class="fa-solid fa-file-pdf"></i> Enviar PDF';
    }

    const labelTheme = document.querySelector('label[for="theme-input"]');
    if (labelTheme) labelTheme.textContent = lang === 'en' ? 'What is the main idea or theme of your story?' :
                                             lang === 'es' ? '¿Cuál es la idea principal o tema de tu historia?' :
                                                             'Qual é a ideia principal ou tema da sua história?';

    const labelText = document.querySelector('label[for="text-input"]');
    if (labelText) labelText.textContent = lang === 'en' ? 'Paste or type your story text' :
                                            lang === 'es' ? 'Pegue o escriba el texto de su historia' :
                                                            'Cole ou digite o texto da sua história';

    const labelPdf = document.querySelector('#group-pdf label');
    if (labelPdf) labelPdf.textContent = lang === 'en' ? 'Select a PDF file to serve as script' :
                                         lang === 'es' ? 'Seleccione un archivo PDF para servir de guión' :
                                                         'Selecione um arquivo PDF para servir de roteiro';

    const dropZoneText = document.querySelector('.file-drop-zone p');
    if (dropZoneText) dropZoneText.innerHTML = lang === 'en' ? 'Drag your PDF here or <span style="color:#a78bfa; text-decoration: underline;">click to choose</span>' :
                                               lang === 'es' ? 'Arrastre su PDF aquí o <span style="color:#a78bfa; text-decoration: underline;">haga clic para elegir</span>' :
                                                               'Arraste seu PDF aqui ou <span style="color:#a78bfa; text-decoration: underline;">clique para escolher</span>';

    const labelGenre = document.querySelector('label[for="genre-select"]');
    if (labelGenre) labelGenre.innerHTML = lang === 'en' ? '<i class="fa-solid fa-masks-theater"></i> Story Style/Genre' :
                                           lang === 'es' ? '<i class="fa-solid fa-masks-theater"></i> Estilo/Género de la Historia' :
                                                           '<i class="fa-solid fa-masks-theater"></i> Estilo/Gênero da História';

    const labelDur = document.querySelector('label[for="duration-select"]');
    if (labelDur) labelDur.innerHTML = lang === 'en' ? '<i class="fa-solid fa-clock"></i> Estimated Duration' :
                                       lang === 'es' ? '<i class="fa-solid fa-clock"></i> Duración Estimada' :
                                                       '<i class="fa-solid fa-clock"></i> Duração Estimada';

    const labelVoice = document.querySelector('label[for="voice-select"]');
    if (labelVoice) labelVoice.innerHTML = lang === 'en' ? '<i class="fa-solid fa-circle-user"></i> Narrator Voice' :
                                           lang === 'es' ? '<i class="fa-solid fa-circle-user"></i> Voz del Narrador' :
                                                           '<i class="fa-solid fa-circle-user"></i> Voz do Narrador';

    const labelVisualTheme = document.getElementById('lbl-narrative-visual-theme');
    if (labelVisualTheme) labelVisualTheme.innerHTML = lang === 'en' ? '<i class="fa-solid fa-palette"></i> Visual Style' :
                                                       lang === 'es' ? '<i class="fa-solid fa-palette"></i> Estilo Visual' :
                                                                       '<i class="fa-solid fa-palette"></i> Estilo Visual';

    if (dom.visualThemeSelect) {
        dom.visualThemeSelect.options[0].text = t.themeOptionClassic;
        dom.visualThemeSelect.options[1].text = t.themeOptionRealistic;
        dom.visualThemeSelect.options[2].text = t.themeOptionMedieval;
        dom.visualThemeSelect.options[3].text = t.themeOptionCaveman;
        dom.visualThemeSelect.options[4].text = t.themeOptionAnime;
        dom.visualThemeSelect.options[5].text = t.themeOptionDisney;
    }

    dom.btnGenerate.innerHTML = t.generateBtn;
    dom.btnNewStory.innerHTML = t.newStoryBtn;
    dom.themeInput.placeholder = t.themePlaceholder;
    dom.textInput.placeholder = t.textPlaceholder;

    const subOpts = {
        classic: document.querySelector('#subtitle-style-select option[value="classic"]'),
        neon: document.querySelector('#subtitle-style-select option[value="neon"]'),
        minimalist: document.querySelector('#subtitle-style-select option[value="minimalist"]'),
        karaoke: document.querySelector('#subtitle-style-select option[value="karaoke"]')
    };
    if (subOpts.classic) subOpts.classic.textContent = t.subStyleClassic;
    if (subOpts.neon) subOpts.neon.textContent = t.subStyleNeon;
    if (subOpts.minimalist) subOpts.minimalist.textContent = t.subStyleMinimalist;
    if (subOpts.karaoke) subOpts.karaoke.textContent = t.subStyleKaraoke;

    if (dom.historyTitleLabel) {
        dom.historyTitleLabel.innerHTML = `<i class="fa-solid fa-folder-open"></i> ${t.historyTitle}`;
    }

    document.getElementById('global-lang-select').value = lang;

    // Auto-select matching narrator voice
    if (dom.voiceSelect) {
        const cv = dom.voiceSelect.value;
        const needsSwitch =
            (lang === 'pt' && !cv.startsWith('pt-')) ||
            (lang === 'en' && !cv.startsWith('en-')) ||
            (lang === 'es' && !cv.startsWith('es-'));
        if (needsSwitch) {
            if (lang === 'en') dom.voiceSelect.value = 'en-US-AndrewNeural';
            else if (lang === 'es') dom.voiceSelect.value = 'es-ES-AlvaroNeural';
            else dom.voiceSelect.value = 'pt-BR-AntonioNeural';
        }
    }
}
