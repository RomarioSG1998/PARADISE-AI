import json
from services.ai_service import generate_text_unified_async, generate_image_unified_async

VISUAL_THEME_STYLES = {
    "cartoon":  "(2D cartoon style illustration, thick black outlines, vibrant flat colors, comic drawing style, playful animation art, no text, no letters, no labels)",
    "anime":    "(anime film illustration, Studio Ghibli or Makoto Shinkai style, soft watercolor backgrounds, detailed characters, cinematic lighting, lush scenery, no text, no labels)",
    "cinema":   "(ultra-realistic cinematic photograph, Hollywood blockbuster style, dramatic lighting, 8K resolution, photorealistic details, no text, no labels)",
    "classic":  "(silent film era, Charlie Chaplin style, black and white photograph, dramatic shadows, vintage grain texture, expressionist composition, no text, no labels)",
    "western":  "(Wild West oil painting illustration, dusty desert landscape, warm sunset palette, cowboy aesthetic, rustic vintage style, no text, no labels)",
}

async def generate_book_async(theme, level, language, visual_theme="cartoon", username=None):
    lang_lower = language.lower()
    style_suffix = VISUAL_THEME_STYLES.get(visual_theme, VISUAL_THEME_STYLES["cartoon"])
    print(f"[Paradise AI] Generating book. Theme: '{theme}', Level: '{level}', Language: '{language}', Visual: '{visual_theme}', User: '{username}'")
    
    if "inglês" in lang_lower or "english" in lang_lower or lang_lower == "en":
        prompt = f"""You must write a custom short book in English.
Translate the theme "{theme}" to English if it is in another language, and write the book about that translated theme.
All story content, titles, and text must be written EXCLUSIVELY in English.
The book must be written for reading level "{level}".

The returned JSON must follow exactly this structure:
{{
  "title": "Book Title in English",
  "theme": "Theme in English",
  "level": "{level}",
  "language": "English",
  "chapters": [
    {{
      "chapter_number": 1,
      "title": "Chapter 1 Title in English",
      "text": "Full text of Chapter 1 (rich and engaging narrative of 3 to 5 paragraphs written in English).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 1 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }},
    {{
      "chapter_number": 2,
      "title": "Chapter 2 Title in English",
      "text": "Full text of Chapter 2 (rich and engaging narrative of 3 to 5 paragraphs written in English).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 2 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }},
    {{
      "chapter_number": 3,
      "title": "Chapter 3 Title in English",
      "text": "Full text of Chapter 3 (rich and exciting conclusion of 3 to 5 paragraphs written in English).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 3 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }}
  ]
}}
Return ONLY the valid JSON block. Do not include any intro or explanation. Wrap the JSON in a markdown code block starting with ```json and ending with ```."""
    elif "espanhol" in lang_lower or "spanish" in lang_lower or "español" in lang_lower or lang_lower == "es":
        prompt = f"""Debes escribir un libro corto personalizado en Español.
Traduce el tema "{theme}" al español si está en otro idioma, y escribe el libro sobre ese tema traducido.
Todo el contenido de la historia, títulos y texto deben estar escritos EXCLUSIVAMENTE en Español.
El libro debe estar escrito para el nivel de lectura "{level}".

El JSON devuelto debe seguir exactamente esta estructura:
{{
  "title": "Título del Libro en Español",
  "theme": "Tema en Español",
  "level": "{level}",
  "language": "Español",
  "chapters": [
    {{
      "chapter_number": 1,
      "title": "Título del Capítulo 1 en Español",
      "text": "Texto completo del Capítulo 1 (narrativa rica y envolvente de 3 a 5 párrafos escrita en Español).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 1 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }},
    {{
      "chapter_number": 2,
      "title": "Título del Capítulo 2 en Español",
      "text": "Texto completo del Capítulo 2 (narrativa rica y envolvente de 3 a 5 párrafos escrita en Español).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 2 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }},
    {{
      "chapter_number": 3,
      "title": "Título del Capítulo 3 en Español",
      "text": "Texto completo del Capítulo 3 (conclusión rica y emocionante de 3 a 5 párrafos escrita en Español).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 3 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }}
  ]
}}
Devuelve SOLO el bloque JSON válido. No incluyas explicaciones. Envuelve el JSON en un bloque de código markdown que comience con ```json y termine con ```."""
    else:
        prompt = f"""Você deve escrever um livro curto personalizado no idioma "{language}".
Traduza o tema "{theme}" para o idioma "{language}" se estiver em outro idioma, e escreva o livro sobre esse tema traduzido.
Todo o conteúdo da história, títulos e texto devem ser escritos EXCLUSIVAMENTE no idioma "{language}".
O livro deve ser escrito para o nível de leitura "{level}".

O JSON retornado deve seguir exatamente esta estrutura:
{{
  "title": "Título do Livro no idioma {language}",
  "theme": "Tema no idioma {language}",
  "level": "{level}",
  "language": "{language}",
  "chapters": [
    {{
      "chapter_number": 1,
      "title": "Título do Capítulo 1 no idioma {language}",
      "text": "Texto completo do Capítulo 1 (narrativa rica e envolvente de 3 a 5 parágrafos escrita no idioma {language}).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 1 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }},
    {{
      "chapter_number": 2,
      "title": "Título do Capítulo 2 no idioma {language}",
      "text": "Texto completo do Capítulo 2 (narrativa rica e envolvente de 3 a 5 parágrafos escrita no idioma {language}).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 2 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }},
    {{
      "chapter_number": 3,
      "title": "Título do Capítulo 3 no idioma {language}",
      "text": "Texto completo do Capítulo 3 (conclusão rica e emocionante de 3 a 5 parágrafos escrita no idioma {language}).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 3 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }}
  ]
}}
Retorne APENAS o bloco JSON válido. Não inclua nenhuma introdução, marcação adicional ou texto fora do bloco de código json. Envolva o JSON em um bloco de código markdown (iniciando com ```json e finalizando com ```)."""

    text_resp, err = await generate_text_unified_async(prompt, username=username)
    if err:
        return None, err
        
    try:
        book_data = {}
        cleaned_text = text_resp.strip()
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
            
        book_data = json.loads(cleaned_text)
        
        # For each chapter, generate the corresponding image using selected visual theme
        for idx, chapter in enumerate(book_data.get("chapters", [])):
            img_prompt = chapter.get("illustration_prompt", f"A beautiful scene depicting {theme}")
            full_img_prompt = f"{img_prompt}. {style_suffix}"
            
            img_url, img_err = await generate_image_unified_async(full_img_prompt, username=username)
            if img_url:
                chapter["image_url"] = img_url
            else:
                chapter["image_error"] = img_err or "Nenhuma imagem retornada"
                
        return book_data, None
    except Exception as e:
        return None, f"Failed to generate book: {str(e)}"

async def illustrate_scene_async(prompt, visual_theme="cartoon", username=None):
    style_suffix = VISUAL_THEME_STYLES.get(visual_theme, VISUAL_THEME_STYLES["cartoon"])
    full_prompt = f"{prompt}. {style_suffix}"
    img_url, img_err = await generate_image_unified_async(full_prompt, username=username)
    if img_url:
        return {"image_url": img_url}, None
    return None, img_err or "Nenhuma imagem retornada"

async def explain_word_async(word, sentence, book_lang, target_lang, user_lang_code, username=None):
    if user_lang_code == "en":
        prompt = f"""Explain the word or expression "{word}" that appears in the following sentence: "{sentence}".
The book is written in the language {book_lang}.
The returned JSON must follow exactly this structure:
{{
  "word": "{word}",
  "translation": "Direct translation of the word/expression to {target_lang}",
  "explanation": "A simple and brief 1-sentence explanation of the meaning within the context of the story written in English.",
  "illustration_prompt": "A simple 2D cartoon vector icon of {word}, white background, colorful, clean outlines, child friendly, clip art style"
}}
Do not add any extra explanation outside the JSON block. Return ONLY the valid JSON."""
    elif user_lang_code == "es":
        prompt = f"""Explica la palabra o expresión "{word}" que aparece en la siguiente frase: "{sentence}".
El libro está escrito en el idioma {book_lang}.
El JSON devuelto debe seguir exactamente esta estructura:
{{
  "word": "{word}",
  "translation": "Traducción directa de la palabra/expresión al {target_lang}",
  "explanation": "Una explicación sencilla y breve de 1 frase sobre el significado en el contexto de la historia escrita en Español.",
  "illustration_prompt": "A simple 2D cartoon vector icon of {word}, white background, colorful, clean outlines, child friendly, clip art style"
}}
No agregues explicaciones adicionales fuera del bloque JSON. Devuelve SOLO el JSON válido."""
    else:
        prompt = f"""Explique a palavra ou expressão "{word}" que aparece na seguinte frase: "{sentence}".
O livro está escrito no idioma {book_lang}.
O JSON retornado deve seguir exatamente este modelo:
{{
  "word": "{word}",
  "translation": "Tradução direta da palavra/expressão para o idioma {target_lang}",
  "explanation": "Explicação simples e breve de 1 frase sobre o significado no contexto da história escrita em Português.",
  "illustration_prompt": "A simple 2D cartoon vector icon of {word}, white background, colorful, clean outlines, child friendly, clip art style"
}}
Não adicione explicações extras fora do bloco JSON. Retorne apenas o JSON válido."""

    text_resp, err = await generate_text_unified_async(prompt, username=username)
    if err:
        return None, err
        
    try:
        cleaned_text = text_resp.strip()
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
            
        data = json.loads(cleaned_text)
        
        # Generate the micro-illustration for this word!
        img_prompt = data.get("illustration_prompt", f"A simple vector cartoon icon of {word}")
        img_url, img_err = await generate_image_unified_async(img_prompt, username=username)
        
        data["image_url"] = img_url
        return data, None
    except Exception as e:
        return None, f"Failed to explain word: {str(e)}"
