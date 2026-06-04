import json
from services.ai_service import generate_text_unified_async, generate_image_unified_async

async def generate_classroom_async(content: str, lang_code: str):
    lang_names = {
        "pt": "Português (Brasil)",
        "en": "Inglês",
        "es": "Espanhol"
    }
    target_lang_name = lang_names.get(lang_code, "Português (Brasil)")

    if lang_code == "en":
        prompt = f"""Create a complete, educational, and structured class about the following topic.
The topic/content is: {content[:8000]}

First, translate the topic/content to English if it is in another language. Write the entire class based on that translated topic/content.
The entire class (including general title, slide titles, teacher narration, and board bullet points) MUST be written exclusively in English.
The class must be divided into 3 to 5 sequential slides explaining the concept logically.
For each slide, you must provide:
1. A short board title (max 50 characters).
2. A dynamic and natural narration text that the teacher (avatar) will speak to explain this slide (3 to 5 sentences in English).
3. 3 to 5 synthetic bullet points to be displayed on the blackboard in English.
4. A detailed prompt in English to generate a white chalk chalkboard diagram.

Return the response EXCLUSIVELY in JSON format (wrapped by ```json ... ```) matching exactly this model:
{{
  "subject": "General Title of the Class in English",
  "slides": [
    {{
      "slide_number": 1,
      "title": "Slide Title in English",
      "narration": "Text that the teacher will speak in English...",
      "bullets": [
        "Synthetic bullet point 1 in English",
        "Synthetic bullet point 2 in English"
      ],
      "image_prompt": "A clean chalkboard style diagram showing the base concept of..."
    }}
  ]
}}
Return only the valid JSON block, with no additional text before or after. Wrap it in a markdown code block starting with ```json and ending with ```."""
    elif lang_code == "es":
        prompt = f"""Crea una clase completa, didáctica y estructurada sobre el siguiente tema.
El tema/contenido es: {content[:8000]}

Primero, traduce el tema/contenido al español si está en otro idioma. Escribe la clase completa basándote en ese tema/contenido traducido.
Toda la clase (incluido el título general, los títulos de las diapositivas, la narración del profesor y los puntos clave de la pizarra) DEBE estar escrita exclusivamente en Español.
La clase debe dividirse en 3 a 5 diapositivas secuenciales que expliquen el concepto de manera lógica.
Para cada diapositiva, debes proporcionar:
1. Un título corto para la pizarra (máximo de 50 caracteres).
2. Un texto explicativo dinámico y natural que hablará el profesor (avatar) para explicar esta diapositiva (de 3 a 5 frases en Español).
3. De 3 a 5 puntos clave (bullet points) sintéticos que se mostrarán en la pizarra en Español.
4. Un prompt detallado en inglés para generar un diagrama de tiza blanca en pizarra verde.

Devuelve la respuesta EXCLUSIVAMENTE en formato JSON (envuelto por ```json ... ```) siguiendo exactamente este modelo:
{{
  "subject": "Título General de la Clase en Español",
  "slides": [
    {{
      "slide_number": 1,
      "title": "Título de la Diapositiva en Español",
      "narration": "Texto que hablará el profesor en Español...",
      "bullets": [
        "Punto sintético 1 en Español",
        "Punto sintético 2 en Español"
      ],
      "image_prompt": "A clean chalkboard style diagram showing the base concept of..."
    }}
  ]
}}
Devuelve solo el bloque JSON válido, sin texto adicional antes o después. Envuélvelo en un bloque de código markdown que comience con ```json y termine con ```."""
    else:
        prompt = f"""Crie uma aula completa, didática e estruturada sobre o assunto a seguir.
O assunto/conteúdo é: {content[:8000]}

Primeiro, traduza o assunto/conteúdo para o português se estiver em outro idioma. Escreva a aula completa com base nesse assunto/conteúdo traduzido.
A aula inteira (incluindo título geral, títulos dos slides, narração do professor e tópicos da lousa) deve ser escrita exclusivamente no idioma Português (Brasil).
A aula deve ser dividida em 3 a 5 partes/telas sequenciais (slides) que explicam o conceito de forma lógica.
Para cada parte/tela da aula, você deve fornecer:
1. Um título curto do quadro (máximo de 50 caracteres).
2. Um texto explicativo dinâmico e natural que o professor (avatar) falará para explicar esse slide (de 3 a 5 frases em Português).
3. De 3 a 5 tópicos (bullet points) sintéticos que serão exibidos no quadro negro/lousa em Português.
4. Um prompt detalhado em inglês para gerar uma ilustração/diagrama técnico estilo desenho de giz (chalk sketch, technical blueprint on dark board) que apoie a explicação dessa parte.

Retorne a resposta EXCLUSIVAMENTE em formato JSON (envolvido por ```json ... ```) seguindo exatamente este modelo:
{{
  "subject": "Título Geral da Aula em Português",
  "slides": [
    {{
      "slide_number": 1,
      "title": "Título do Slide em Português",
      "narration": "Texto que o professor irá falar nesta parte em Português...",
      "bullets": [
        "Tópico sintético 1 em Português",
        "Tópico sintético 2 em Português"
      ],
      "image_prompt": "A clean chalkboard style diagram showing the base concept of..."
    }}
  ]
}}
Retorne apenas o bloco JSON válido, sem texto adicional antes ou depois. Envolva o JSON em um bloco de código markdown (iniciando com ```json e finalizando com ```)."""

    # Generate lesson script
    text_resp, err = await generate_text_unified_async(prompt)
    if err:
        raise Exception(f"Falha ao gerar roteiro da aula: {err}")
        
    try:
        cleaned_text = text_resp.strip()
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
            
        lesson_data = json.loads(cleaned_text)
    except Exception as parse_err:
        print(f"[Classroom Parser Error] {parse_err}. Response text was: {text_resp}")
        raise Exception("Erro ao interpretar resposta do modelo. Tente novamente.")

    # Generate illustrations for slides
    slides = lesson_data.get("slides", [])
    for idx, slide in enumerate(slides):
        img_prompt = slide.get("image_prompt", f"A technical chalkboard drawing about {lesson_data.get('subject', 'education')}")
        # Inject standard style modifiers to guarantee nice classroom drawings
        full_img_prompt = f"Gere uma imagem de: {img_prompt}. (white chalk sketch on blackboard, blackboard drawing style, schematic, educational blueprint, dark green board background, technical drawing, no letters, no text, outline drawing)"
        
        img_url, img_err = await generate_image_unified_async(full_img_prompt)
        if img_url:
            slide["image_url"] = img_url
        else:
            slide["image_error"] = img_err or "Nenhuma imagem retornada"

    return lesson_data
