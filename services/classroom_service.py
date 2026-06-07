import json
from services.ai_service import generate_text_unified_async, generate_image_unified_async

async def generate_classroom_async(content: str, lang_code: str, duration_min="3", username=None):
    try:
        num_slides = max(2, min(20, int(duration_min) * 2))
    except ValueError:
        num_slides = 6

    lang_names = {
        "pt": "Português (Brasil)",
        "en": "Inglês",
        "es": "Espanhol"
    }

    if lang_code == "en":
        prompt = f"""You are an expert, highly engaging teacher creating a compelling, dynamic slide-based lesson.
Your goal is to teach the following content in English.
The lesson must be designed to take approximately {duration_min} minutes to deliver aloud. Therefore, you MUST divide the lesson into exactly {num_slides} sequential parts/screens (slides) that explain the concept logically.
The topic/content is: {content[:8000]}

First, translate the topic/content to English if it is in another language. Write the entire class based on that translated topic/content.
The entire class (including general title, slide titles, teacher narration, and board bullet points) MUST be written exclusively in English.

For each slide, you must provide:
1. A short board title (max 50 characters). If there are math formulas, use standard LaTeX notation enclosed in '$' (e.g. $x^2 + y^2 = z^2$).
2. A dynamic and natural narration text that the teacher (avatar) will speak to explain this slide (3 to 5 sentences in English). IMPORTANT: This text is read aloud by a Text-to-Speech (TTS) system. Therefore, NEVER use LaTeX notation, dollar signs ($), or raw mathematical symbols like ^, _, \\sqrt in the narration. Instead, write math formulas out in natural spoken English words exactly as they should be pronounced (e.g., write 'x squared plus y squared equals z squared' instead of '$x^2 + y^2 = z^2$'; write 'the integral of x' or 'square root of y').
3. 3 to 5 synthetic bullet points to be displayed on the blackboard in English. For math formulas in these bullet points, always use standard LaTeX notation enclosed in '$ ... $' (for inline math) or '$$ ... $$' (for display equations) so they render correctly on the blackboard.
4. A detailed prompt in English to generate a white chalk chalkboard diagram.

Return the response EXCLUSIVELY in JSON format (wrapped by ```json ... ```) matching exactly this model:
{{
  "subject": "General Title of the Class in English",
  "thumbnail_prompt": "Highly detailed English prompt for a cinematic YouTube thumbnail artwork representing this class. Style should be clean, digital art, no text, no letters.",
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
Return exactly {num_slides} slides in the array. Return only the valid JSON block, with no additional text before or after."""
    elif lang_code == "es":
        prompt = f"""Crea una clase completa, didáctica y estructurada sobre el siguiente tema.
El tema/contenido es: {content[:8000]}

Primero, traduce el tema/contenido al español si está en otro idioma. Escribe la clase completa basándote en ese tema/contenido traducido.
Tu objetivo es enseñar el siguiente contenido en Español.
La clase debe estar diseñada para durar aproximadamente {duration_min} minutos. Por lo tanto, DEBES dividir la lección en exactamente {num_slides} partes/pantallas secuenciales (diapositivas) que expliquen el concepto lógicamente.

Para cada diapositiva, debes proporcionar:
1. Un título corto para la pizarra (máximo de 50 caracteres). Si hay fórmulas matemáticas, usa notación LaTeX estándar envuelta en '$' (ej. $x^2 + y^2 = z^2$).
2. Un texto explicativo dinámico y natural que hablará el profesor (avatar) para explicar esta diapositiva (de 3 a 5 frases en Español). IMPORTANTE: Este texto será leído en voz alta por un sistema de texto a voz (TTS). Por lo tanto, NUNCA uses notación LaTeX, signos de dólar ($), ni símbolos matemáticos crudos como ^, _, \\sqrt en la narración. En su lugar, escribe las fórmulas matemáticas con palabras habladas naturales en español tal como se deben pronunciar (ej. escribe 'x al cuadrado más y al cuadrado es igual a z al cuadrado' en lugar de '$x^2 + y^2 = z^2$'; escribe 'la integral de x' o 'la raíz cuadrada de y').
3. De 3 a 5 puntos clave (bullet points) sintéticos que se mostrarán en la pizarra en Español. Para fórmulas matemáticas en estos puntos, usa siempre notación LaTeX estándar envuelta en '$ ... $' (para fórmulas en línea) o '$$ ... $$' (para ecuaciones destacadas) para que se rendericen correctamente en la pizarra.
4. Un prompt detallado en inglés para generar un diagrama de tiza blanca en pizarra verde.

Devuelve la respuesta EXCLUSIVAMENTE en formato JSON (envuelto por ```json ... ```) siguiendo exactamente este modelo:
{{
  "subject": "Título General de la Clase en Español",
  "thumbnail_prompt": "Highly detailed English prompt for a cinematic YouTube thumbnail artwork representing this class. Style should be clean, digital art, no text, no letters.",
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
Devuelve exactamente {num_slides} diapositivas. Devuelve solo el bloque JSON válido, sin texto adicional antes o después."""
    else:
        prompt = f"""Crie uma aula completa, didática e estruturada sobre o assunto a seguir.
O assunto/conteúdo é: {content[:8000]}

Primeiro, traduza o assunto/conteúdo para o português se estiver em outro idioma. Escreva a aula completa com base nesse assunto/conteúdo traduzido.
Seu objetivo é ensinar o seguinte conteúdo em Português (Brasil).
A aula deve ser planejada para durar cerca de {duration_min} minutos. Para isso, DEVE ser dividida em exatamente {num_slides} partes/telas sequenciais (slides) que explicam o conceito de forma lógica.

Para cada parte/tela da aula, você deve fornecer:
1. Um título curto do quadro (máximo de 50 caracteres). Se houver fórmulas matemáticas complexas, use notação LaTeX padrão envolvida em '$' (ex: $x^2 + y^2 = z^2$).
2. Um texto explicativo dinâmico e natural que o professor (avatar) falará para explicar esse slide (de 3 a 5 frases em Português). IMPORTANTE: Este texto será lido em voz alta por um sistema de conversão de texto em fala (TTS). Portanto, NUNCA use notação LaTeX, símbolos matemáticos brutos como ^, _, \\sqrt, ou cifrões ($) na narração. Em vez disso, escreva as fórmulas por extenso exatamente como devem ser faladas em português (ex: escreva 'x ao quadrado mais y ao quadrado é igual a z ao quadrado' em vez de '$x^2 + y^2 = z^2$'; escreva 'a integral de x' ou 'raiz quadrada de y').
3. De 3 a 5 tópicos (bullet points) sintéticos que serão exibidos no quadro negro/lousa em Português. Para fórmulas matemáticas nestes tópicos, use sempre notação LaTeX padrão envolta em '$ ... $' (para fórmulas em linha) ou '$$ ... $$' (para equações destacadas) para que sejam renderizadas corretamente no quadro.
4. Um prompt detalhado em inglês para gerar uma ilustração/diagrama técnico estilo desenho de giz (chalk sketch, technical blueprint on dark board) que apoie a explicação dessa parte.

Retorne a resposta EXCLUSIVAMENTE em formato JSON (envolvido por ```json ... ```) seguindo exatamente este modelo:
{{
  "subject": "Título Geral da Aula em Português",
  "thumbnail_prompt": "Highly detailed English prompt for a cinematic YouTube thumbnail artwork representing this class. Style should be clean, digital art, no text, no letters.",
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
Retorne exatamente {num_slides} slides. Retorne apenas o bloco JSON válido, sem texto adicional antes ou depois."""

    # Generate lesson script
    text_resp, err = await generate_text_unified_async(prompt, username=username)
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
        
        img_url, img_err = await generate_image_unified_async(full_img_prompt, username=username)
        if img_url:
            slide["image_url"] = img_url
        else:
            slide["image_error"] = img_err or "Nenhuma imagem retornada"

    # Generate the YouTube Thumbnail
    thumb_base_prompt = lesson_data.get("thumbnail_prompt", f"A beautiful cinematic cover artwork for an educational video about {lesson_data.get('subject', 'education')}")
    full_thumb_prompt = f"Professional high-CTR YouTube video thumbnail poster artwork: {thumb_base_prompt}. (vivid color pop, dramatic rim lighting, intense emotional expression, shallow depth of field, blurred bokeh background, hyper-detailed digital art, high dynamic range (HDR), textless, epic cinematic composition, 8k)"
    thumb_url, thumb_err = await generate_image_unified_async(full_thumb_prompt, username=username)
    if thumb_url:
        lesson_data["thumbnail_url"] = thumb_url
    else:
        lesson_data["thumbnail_error"] = thumb_err or "Nenhuma imagem retornada"

    return lesson_data


async def generate_classroom_explanation_async(subject: str, slide_title: str, slide_narration: str, question: str, lang_code: str, username=None):
    lang_names = {
        "pt": "Português (Brasil)",
        "en": "Inglês",
        "es": "Espanhol"
    }
    target_lang_name = lang_names.get(lang_code, "Português (Brasil)")

    if lang_code == "en":
        prompt = f"""You are a teacher explaining the class '{subject}'.
The user is currently on a slide titled '{slide_title}' with this explanation:
'{slide_narration}'

The user interrupts you and asks: '{question}'

Answer the question directly, concisely, and didactically as a teacher.
Format your explanation as a single custom slide.
The entire response (slide title, narration, and bullet points) MUST be written exclusively in English.
Provide:
1. A short title for the board answering/relating to the question (max 50 characters). If there are math formulas, use standard LaTeX notation enclosed in '$' (e.g. $x^2 + y^2 = z^2$).
2. A narration text that you (the teacher) will speak to answer this question (3 to 5 sentences in English). IMPORTANT: This text is read aloud by a Text-to-Speech (TTS) system. Therefore, NEVER use LaTeX notation, dollar signs ($), or raw mathematical symbols like ^, _, \\sqrt in the narration. Instead, write math formulas out in natural spoken English words exactly as they should be pronounced (e.g., write 'x squared plus y squared equals z squared' instead of '$x^2 + y^2 = z^2$'; write 'the integral of x' or 'square root of y').
3. 3 to 5 synthetic bullet points to be displayed on the blackboard in English. For math formulas in these bullet points, always use standard LaTeX notation enclosed in '$ ... $' (for inline math) or '$$ ... $$' (for display equations) so they render correctly on the blackboard.
4. A detailed prompt in English to generate a white chalk chalkboard diagram summarizing the answer.

Return the response EXCLUSIVELY in JSON format (wrapped by ```json ... ```) matching exactly this model:
{{
  "title": "Board Title in English",
  "narration": "Narration text answering the question in English...",
  "bullets": [
    "Synthetic bullet point 1",
    "Synthetic bullet point 2"
  ],
  "image_prompt": "A clean chalkboard style diagram showing..."
}}
Return only the valid JSON block, with no additional text before or after."""
    elif lang_code == "es":
        prompt = f"""Eres un profesor explicando la clase '{subject}'.
El usuario se encuentra en la diapositiva titulada '{slide_title}' con esta explicación:
'{slide_narration}'

El usuario te interrumpe y pregunta: '{question}'

Responde a la pregunta de forma directa, concisa y didáctica como profesor.
Estructura tu explicación como una sola diapositiva personalizada.
Toda la respuesta (título de la pizarra, narración y puntos clave) DEBE estar escrita exclusivamente en Español.
Proporciona:
1. Un título corto para la pizarra que responda o se relacione con la pregunta (máximo de 50 caracteres). Si hay fórmulas matemáticas, usa notación LaTeX estándar envuelta en '$' (ej. $x^2 + y^2 = z^2$).
2. Un texto de narración que tú (el profesor) hablarás para responder a la pregunta (de 3 a 5 frases en Español). IMPORTANTE: Este texto será leído en voz alta por un sistema de texto a voz (TTS). Por lo tanto, NUNCA uses notación LaTeX, signos de dólar ($), ni símbolos matemáticos crudos como ^, _, \\sqrt en la narración. En su lugar, escribe las fórmulas matemáticas con palabras habladas naturales en español tal como se deben pronunciar (ej. escribe 'x al cuadrado más y al cuadrado es igual a z al cuadrado' en lugar de '$x^2 + y^2 = z^2$'; escribe 'la integral de x' o 'la raíz cuadrada de y').
3. De 3 a 5 puntos clave sintéticos que se mostrarán en la pizarra en Español. Para fórmulas matemáticas en estos puntos, usa siempre notación LaTeX estándar envuelta en '$ ... $' (para fórmulas en línea) o '$$ ... $$' (para ecuaciones destacadas) para que se rendericen correctamente en la pizarra.
4. Un prompt detallado en inglés para generar un diagrama de tiza blanca en pizarra verde que resuma la respuesta.

Devuelve la respuesta EXCLUSIVAMENTE en formato JSON (envuelto por ```json ... ```) siguiendo exactamente este modelo:
{{
  "title": "Título de la Pizarra en Español",
  "narration": "Texto de narración respondiendo a la pregunta en Español...",
  "bullets": [
    "Punto sintético 1",
    "Punto sintético 2"
  ],
  "image_prompt": "A clean chalkboard style diagram showing..."
}}
Devuelve solo el bloque JSON válido, sin texto adicional antes o después."""
    else:
        prompt = f"""Você é um professor explicando a aula '{subject}'.
O usuário está no slide intitulado '{slide_title}' com a seguinte explicação:
'{slide_narration}'

O usuário interrompe a aula e faz a seguinte pergunta: '{question}'

Responda à pergunta de forma direta, concisa e didática como professor.
Estruture a sua explicação em formato de um slide personalizado.
Toda a resposta (título do quadro, narração e tópicos) deve ser escrita exclusivamente no idioma Português (Brasil).
Forneça:
1. Um título curto do quadro que responda ou se relacione com a pergunta (máximo de 50 caracteres). Se houver fórmulas matemáticas complexas, use notação LaTeX padrão envolvida em '$' (ex: $x^2 + y^2 = z^2$).
2. Um texto de narração que você (o professor) falará para responder a esta pergunta (de 3 a 5 frases em Português). IMPORTANTE: Este texto será lido em voz alta por um sistema de conversão de texto em fala (TTS). Portanto, NUNCA use notação LaTeX, símbolos matemáticos brutos como ^, _, \\sqrt, ou cifrões ($) na narração. Em vez disso, escreva as fórmulas por extenso exatamente como devem ser faladas em português (ex: escreva 'x ao quadrado mais y ao quadrado é igual a z ao quadrado' em vez de '$x^2 + y^2 = z^2$'; escreva 'a integral de x' ou 'raiz quadrada de y').
3. De 3 a 5 tópicos (bullet points) sintéticos que serão exibidos no quadro negro/lousa em Português. Para fórmulas matemáticas nestes tópicos, use sempre notação LaTeX padrão envolta em '$ ... $' (para fórmulas em linha) ou '$$ ... $$' (para equações destacadas) para que sejam renderizadas corretamente no quadro.
4. Um prompt detalhado em inglês para gerar uma ilustração/diagrama técnico estilo desenho de giz (chalk sketch, technical blueprint on dark board) que resuma a resposta.

Retorne a resposta EXCLUSIVAMENTE em formato JSON (envolvido por ```json ... ```) seguindo exatamente este modelo:
{{
  "title": "Título do Quadro em Português",
  "narration": "Texto de narração respondendo à pergunta em Português...",
  "bullets": [
    "Tópico sintético 1",
    "Tópico sintético 2"
  ],
  "image_prompt": "A clean chalkboard style diagram showing..."
}}
Retorne apenas o bloco JSON válido, sem texto adicional antes ou depois."""

    # Generate explanation script
    text_resp, err = await generate_text_unified_async(prompt, username=username)
    if err:
        raise Exception(f"Falha ao obter resposta do professor: {err}")

    try:
        cleaned_text = text_resp.strip()
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
            
        explanation_data = json.loads(cleaned_text)
    except Exception as parse_err:
        print(f"[Explanation Parser Error] {parse_err}. Response text was: {text_resp}")
        raise Exception("Erro ao interpretar resposta do professor. Tente novamente.")

    # Generate image for explanation
    img_prompt = explanation_data.get("image_prompt", "A chalkboard technical schematic illustrating the answer")
    full_img_prompt = f"Gere uma imagem de: {img_prompt}. (white chalk sketch on blackboard, blackboard drawing style, schematic, educational blueprint, dark green board background, technical drawing, no letters, no text, outline drawing)"
    
    img_url, img_err = await generate_image_unified_async(full_img_prompt, username=username)
    if img_url:
        explanation_data["image_url"] = img_url
    else:
        explanation_data["image_error"] = img_err or "Nenhuma imagem de ilustração retornada"

    return explanation_data
