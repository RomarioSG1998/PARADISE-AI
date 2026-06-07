import json
import os
from services.ai_service import generate_text_unified_async, generate_image_unified_async

async def generate_narrative_async(content: str, genre: str, duration_min: int, voice_id: str, language: str = "pt", output_format: str = "youtube", username=None):
    # Set segments count based on duration
    # We estimate ~3 segments per minute (each ~45 words)
    # Allows scaling up to e.g. 10 minutes = 30 scenes
    num_segments = max(3, min(60, int(duration_min) * 3))

    # Match genre styles for stable diffusion/imagen prompts
    genre_styles = {
        "terror": "dark fantasy, gothic horror, eerie atmosphere, misty shadows, cinematic lighting, dramatic contrast, highly detailed, photorealistic, 8k",
        "suspense": "film noir style, dark alleyways, dramatic side lighting, high contrast, mysterious silhouettes, cinematic composition, moody, realism",
        "infantil": "colorful cartoon, cute digital painting, children's book illustration, whimsical, soft lightning, friendly characters, pastel color palette",
        "fantasia": "epic fantasy, mystical glowing elements, vibrant magical environment, digital painting, majestic landscape, concept art, magical realism",
        "scifi": "futuristic science fiction, cyberpunk cityscapes, space nebulas, neon glow, high tech holographic displays, cinematic digital concept art",
        "romance": "romantic digital painting, warm golden hour lighting, soft focus, intimate cinematic composition, aesthetic pastel tones, detailed realism"
    }

    style_modifier = genre_styles.get(genre.lower(), "cinematic digital painting, highly detailed, expressive lighting")

    # Build an explicit language instruction based on the active global language
    lang_names = {"pt": "Portuguese (Brazilian)", "en": "English", "es": "Spanish"}
    lang_label = lang_names.get(language, "Portuguese (Brazilian)")
    lang_instruction = (
        f"MANDATORY LANGUAGE RULE: The entire narrative — including the title, description, and ALL segment narration texts — "
        f"MUST be written EXCLUSIVELY in {lang_label}. "
        f"Do NOT use any other language for any narrative text field. "
        f"(Note: image_prompt and thumbnail_prompt fields must always remain in English for the image generator.)"
    )

    prompt = f"""Create a complete, captivating and immersive narrative about the following subject.
The subject/content is: {content[:8000]}

Chosen Genre: {genre}
Target Duration: {duration_min} minutes (the narrative must have exactly {num_segments} parts/scenes).

{lang_instruction}

YOUTUBE THUMBNAIL COMPOSITION INSTRUCTIONS:
- Create an extremely detailed "thumbnail_prompt" in English. To achieve high YouTube engagement (CTR), the description MUST focus on a dramatic close-up of a single character with an exaggerated expression of extreme emotion (e.g. dread, shock, fury or astonishment) or a mysterious, glowing object in close-up. Describe highly saturated colors with strong contrast, bright rim lighting, dramatic shadows, and slightly blurred background (bokeh/shallow depth of field) for cinematic depth. No text, letters, or marks.

STORY STRUCTURE AND SCRIPT INSTRUCTIONS:
- The story must be divided into exactly {num_segments} sequential segments/scenes that make chronological sense.
- Each segment must contain approximately 40 to 55 words of narration text.
- IMPORTANT: The narration text of each segment will be read by a text-to-speech (TTS) system. Therefore:
  1. Do NOT use markdown (e.g., **bold**, *italic*).
  2. Do NOT use special formatting, bullet points, or special symbols.
  3. Write the text in clean, flowing prose, exactly as it should be read by the narrator.
  4. Ensure the reading flows naturally and is emotionally engaging.

IMAGE INSTRUCTIONS:
- For each segment, you must create a detailed "image_prompt" in English.
- The "image_prompt" must visually describe what happens in that specific scene, incorporating setting, characters, mood, and color elements.
- Do NOT include any text or letters in the images.

Return the response EXCLUSIVELY in JSON format (wrapped in ```json ... ```) following exactly this model:
{{
  "title": "General Narrative Title",
  "description": "A brief synopsis or description of the story.",
  "genre": "{genre}",
  "thumbnail_prompt": "A high-impact, high-CTR YouTube thumbnail prompt in English describing a dramatic close-up of the main subject/character with extreme emotional expression, intense glowing rim lighting, vibrant color pop, highly detailed digital art, blurred background, textless.",
  "segments": [
    {{
      "segment_number": 1,
      "text": "Flowing narration text of the first segment in {lang_label}...",
      "image_prompt": "A detailed scene description in English for the image generator, describing what is visually happening in this segment..."
    }}
  ]
}}
Return only the valid JSON block, without any additional text before or after. Wrap the JSON in a markdown code block (starting with ```json and ending with ```)."""

    text_resp, err = await generate_text_unified_async(prompt, username=username)
    if err:
        raise Exception(f"Falha ao gerar roteiro da narrativa: {err}")

    try:
        cleaned_text = text_resp.strip()
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()

        narrative_data = json.loads(cleaned_text)
    except Exception as parse_err:
        print(f"[Narrative Parser Error] {parse_err}. Response text was: {text_resp}")
        raise Exception("Erro ao interpretar o JSON gerado pela IA. Tente novamente.")

    # Generate illustrations for all segments
    segments = narrative_data.get("segments", [])
    for idx, segment in enumerate(segments):
        img_prompt = segment.get("image_prompt", f"A beautiful cinematic scene illustrating the story: {narrative_data.get('title', 'story')}")
        # Inject style modifier corresponding to the genre
        full_img_prompt = f"{img_prompt}. ({style_modifier}, no text, no letters, cinematic composition, atmospheric lighting, detailed artwork)"

        img_url, img_err = await generate_image_unified_async(full_img_prompt, username=username, output_format=output_format)
        if img_url:
            segment["image_url"] = img_url
        else:
            segment["image_error"] = img_err or "Nenhuma imagem retornada"

    # Generate YouTube thumbnail for the story
    title = narrative_data.get("title", "Uma História Incrível")
    gpt_thumb_prompt = narrative_data.get("thumbnail_prompt", "").strip()
    if gpt_thumb_prompt:
        thumb_prompt = f"Professional high-CTR YouTube video thumbnail artwork: {gpt_thumb_prompt}. ({style_modifier}, vivid color pop, dramatic rim lighting, intense emotional expression, shallow depth of field, blurred bokeh background, hyper-detailed digital art, high dynamic range (HDR), textless, epic cinematic composition, 8k)"
    else:
        thumb_prompt = f"Professional high-CTR YouTube video thumbnail poster artwork: A highly dramatic close-up of a central element or character showing intense emotion related to '{title}'. Genre: {genre}. ({style_modifier}, vivid color pop, dramatic rim lighting, intense emotional expression, shallow depth of field, blurred bokeh background, hyper-detailed digital art, high dynamic range (HDR), textless, epic cinematic composition, 8k)"
        
    thumb_url, thumb_err = await generate_image_unified_async(thumb_prompt, username=username)
    if thumb_url:
        narrative_data["thumbnail_url"] = thumb_url
    else:
        narrative_data["thumbnail_url"] = ""

    return narrative_data
