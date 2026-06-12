import json
from services.ai_service import generate_text_unified_async, generate_image_unified_async
from services.classroom_service import (
    STYLE_PROMPT_MAP,
    STYLE_THUMB_MAP,
    STYLE_LLM_PROMPT_MAP,
    sanitize_image_prompt
)

async def generate_book_async(theme, level, language, visual_theme="classic", duration_min="3", output_format="youtube", username=None):
    lang_lower = language.lower()
    style_suffix = STYLE_PROMPT_MAP.get(visual_theme, STYLE_PROMPT_MAP["classic"])
    llm_style = STYLE_LLM_PROMPT_MAP.get(visual_theme, STYLE_LLM_PROMPT_MAP["classic"])
    style_desc = llm_style["en_desc"]
    example_desc = llm_style["example"]
    
    try:
        num_chapters = max(1, min(20, int(duration_min) * 2))
    except ValueError:
        num_chapters = 6
        
    print(f"[Paradise AI] Generating book. Theme: '{theme}', Level: '{level}', Language: '{language}', Visual: '{visual_theme}', Duration: {duration_min}m ({num_chapters} ch), User: '{username}'")
    
    if "inglês" in lang_lower or "english" in lang_lower or lang_lower == "en":
        prompt = f"""You must write a custom short book in English.
Translate the theme "{theme}" to English if it is in another language, and write the book about that translated theme.
All story content, titles, and text must be written EXCLUSIVELY in English.
The book must be written for reading level "{level}".
The book must be designed to take approximately {duration_min} minutes to read aloud. Therefore, you must divide the story into EXACTLY {num_chapters} chapters.

The returned JSON must follow exactly this structure:
{{
  "title": "Book Title in English",
  "theme": "Theme in English",
  "level": "{level}",
  "language": "English",
  "thumbnail_prompt": "Highly detailed English prompt for a cinematic YouTube thumbnail or book cover artwork representing this story. Style should be clean, digital art, no text, no letters.",
  "chapters": [
    {{
      "chapter_number": 1,
      "title": "Chapter 1 Title in English",
      "text": "Full text of Chapter 1 (rich and engaging narrative of 3 to 5 paragraphs written in English).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 1 for a high-quality image generator. Style must be: {style_desc}. Example: {example_desc}"
    }},
    ... (generate EXACTLY {num_chapters} chapters following this exact format)
  ]
}}
Return ONLY the valid JSON block. Do not include any intro or explanation. Wrap the JSON in a markdown code block starting with ```json and ending with ```."""
    elif "espanhol" in lang_lower or "spanish" in lang_lower or "español" in lang_lower or lang_lower == "es":
        prompt = f"""Debes escribir un libro corto personalizado en Español.
Traduce el tema "{theme}" al español si está en otro idioma, y escribe el libro sobre ese tema traducido.
Todo el contenido de la historia, títulos y texto deben estar escritos EXCLUSIVAMENTE en Español.
El libro debe estar escrito para el nivel de lectura "{level}".
El libro debe estar diseñado para leerse en voz alta en aproximadamente {duration_min} minutos, por lo que debes dividir la historia en EXACTAMENTE {num_chapters} capítulos.

El JSON devuelto debe seguir exactamente esta estructura:
{{
  "title": "Título del Libro en Español",
  "theme": "Tema en Español",
  "level": "{level}",
  "language": "Español",
  "thumbnail_prompt": "Highly detailed English prompt for a cinematic YouTube thumbnail or book cover artwork representing this story. Style should be clean, digital art, no text, no letters.",
  "chapters": [
    {{
      "chapter_number": 1,
      "title": "Título del Capítulo 1 en Español",
      "text": "Texto completo del Capítulo 1 (narrativa rica y envolvente de 3 a 5 párrafos escrita en Español).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 1 for a high-quality image generator. Style must be: {style_desc}. Example: {example_desc}"
    }},
    ... (genera EXACTAMENTE {num_chapters} capítulos siguiendo este formato)
  ]
}}
Devuelve SOLO el bloque JSON válido. No incluyas explicaciones. Envuelve el JSON en un bloque de código markdown que comience con ```json y termine con ```."""
    else:
        prompt = f"""Você deve escrever um livro curto personalizado no idioma "{language}".
Traduza o tema "{theme}" para o idioma "{language}" se estiver em outro idioma, e escreva o livro sobre esse tema traduzido.
Todo o conteúdo da história, títulos e texto devem ser escritos EXCLUSIVAMENTE no idioma "{language}".
O livro deve ser escrito para o nível de leitura "{level}".
O livro deve ser planejado para demorar cerca de {duration_min} minutos sendo lido em voz alta. Para isso, crie EXATAMENTE {num_chapters} capítulos.

O JSON retornado deve seguir exatamente esta estrutura:
{{
  "title": "Título do Livro no idioma {language}",
  "theme": "Tema no idioma {language}",
  "level": "{level}",
  "language": "{language}",
  "thumbnail_prompt": "Highly detailed English prompt for a cinematic YouTube thumbnail or book cover artwork representing this story. Style should be clean, digital art, no text, no letters.",
  "chapters": [
    {{
      "chapter_number": 1,
      "title": "Título do Capítulo 1 no idioma {language}",
      "text": "Texto completo do Capítulo 1 (narrativa rica e envolvente de 3 a 5 parágrafos escrita no idioma {language}).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 1 for a high-quality image generator. Style must be: {style_desc}. Example: {example_desc}"
    }},
    ... (gere EXATAMENTE {num_chapters} capítulos seguindo este formato exato)
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
            sanitized = sanitize_image_prompt(img_prompt, visual_theme)
            full_img_prompt = f"{sanitized}. {style_suffix}"
            
            img_url, img_err = await generate_image_unified_async(full_img_prompt, username=username, output_format=output_format)
            if img_url:
                chapter["image_url"] = img_url
            else:
                chapter["image_error"] = img_err or "Nenhuma imagem retornada"
                
        # Generate the YouTube/Book Thumbnail
        thumb_base_prompt = book_data.get("thumbnail_prompt", f"A beautiful cinematic cover artwork for {theme}")
        sanitized_thumb = sanitize_image_prompt(thumb_base_prompt, visual_theme)
        thumb_suffix = STYLE_THUMB_MAP.get(visual_theme, STYLE_THUMB_MAP["classic"])
        full_thumb_prompt = f"Professional high-CTR YouTube video thumbnail poster artwork: {sanitized_thumb}. {thumb_suffix}"
        thumb_url, thumb_err = await generate_image_unified_async(full_thumb_prompt, username=username, output_format=output_format)
        if thumb_url:
            book_data["thumbnail_url"] = thumb_url
        else:
            book_data["thumbnail_error"] = thumb_err or "Nenhuma imagem retornada"
                
        return book_data, None
    except Exception as e:
        return None, f"Failed to generate book: {str(e)}"

async def illustrate_scene_async(prompt, visual_theme="classic", output_format="youtube", username=None):
    style_suffix = STYLE_PROMPT_MAP.get(visual_theme, STYLE_PROMPT_MAP["classic"])
    sanitized = sanitize_image_prompt(prompt, visual_theme)
    full_prompt = f"{sanitized}. {style_suffix}"
    img_url, img_err = await generate_image_unified_async(full_prompt, username=username, output_format=output_format)
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
