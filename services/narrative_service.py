import json
import os
from services.ai_service import generate_text_unified_async, generate_image_unified_async

async def generate_narrative_async(content: str, genre: str, duration_min: int, voice_id: str, username=None):
    # Set segments count based on duration
    # 1 min -> 3 segments (~45 words per segment, total ~135 words)
    # 2 min -> 6 segments (~45 words per segment, total ~270 words)
    # 3 min -> 9 segments (~45 words per segment, total ~400 words)
    num_segments = max(3, min(12, int(duration_min) * 3))

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

    prompt = f"""Crie uma narrativa completa, cativante e imersiva sobre o assunto a seguir.
O assunto/conteúdo é: {content[:8000]}

Gênero Escolhido: {genre}
Duração Alvo: {duration_min} minutos (a narrativa deve ter exatamente {num_segments} partes/cenas).

INSTRUÇÕES DE IDIOMA:
- A narrativa (título, descrição e os textos de narração dos segmentos) deve ser escrita no MESMO IDIOMA do texto de entrada do usuário. Se a entrada estiver em português, tudo em português. Se estiver em inglês, tudo em inglês. Se estiver em espanhol, tudo em espanhol.

INSTRUÇÕES DE ESTRUTURAÇÃO E ROTEIRO:
- A história deve ser dividida em exatamente {num_segments} segmentos/cenas sequenciais que façam sentido cronológico.
- Cada segmento deve conter um texto de narração de aproximadamente 40 a 55 palavras.
- IMPORTANTE: O texto da narração de cada segmento será lido por um sistema de conversão de texto em voz (TTS). Portanto:
  1. NÃO use markdown (como **negrito**, *itálico*).
  2. NÃO use formatação especial, marcadores ou símbolos especiais.
  3. Escreva o texto de forma limpa e corrida, exatamente como deve ser lido pelo narrador.
  4. Certifique-se de que a leitura flua de forma natural e emocionante.

INSTRUÇÕES DE IMAGEM:
- Para cada segmento, você deve criar um "image_prompt" detalhado em inglês.
- O "image_prompt" deve descrever visualmente o que acontece naquela cena específica da história, incorporando elementos de cenário, personagens, clima e cores.
- NÃO inclua textos ou letras nas imagens.

Retorne a resposta EXCLUSIVAMENTE em formato JSON (envolvido por ```json ... ```) seguindo exatamente este modelo:
{{
  "title": "Título Geral da Narrativa",
  "description": "Uma breve sinopse ou descrição da história.",
  "genre": "{genre}",
  "segments": [
    {{
      "segment_number": 1,
      "text": "Texto corrido de narração do primeiro segmento...",
      "image_prompt": "A detailed scene description in English for the image generator, describing what is visually happening in this segment..."
    }}
  ]
}}
Retorne apenas o bloco JSON válido, sem texto adicional antes ou depois. Envolva o JSON em um bloco de código markdown (iniciando com ```json e finalizando com ```)."""

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
        full_img_prompt = f"Gere uma imagem de: {img_prompt}. ({style_modifier}, no text, no letters, cinematic composition, atmospheric lighting, detailed artwork)"

        img_url, img_err = await generate_image_unified_async(full_img_prompt, username=username)
        if img_url:
            segment["image_url"] = img_url
        else:
            segment["image_error"] = img_err or "Nenhuma imagem retornada"

    return narrative_data
