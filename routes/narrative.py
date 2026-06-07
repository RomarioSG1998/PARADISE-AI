import io
from flask import Blueprint, request, jsonify, render_template, session, send_file
from services.narrative_service import generate_narrative_async
from utils.async_loop import run_in_background
from pypdf import PdfReader

narrative_bp = Blueprint("narrative", __name__)

@narrative_bp.route("/narrative")
def index_narrative():
    if not session.get("authenticated"):
        from flask import redirect, url_for
        return redirect(url_for("auth.login"))
    return render_template("narrative.html")

@narrative_bp.route("/api/narrative/generate", methods=["POST"])
def generate_narrative():
    input_type = "theme"
    content = ""
    genre = "fantasia"
    duration = 1
    voice = "pt-BR-AntonioNeural"

    if request.is_json:
        data = request.get_json() or {}
        input_type = data.get("type", "theme")
        content = data.get("content", "").strip()
        genre = data.get("genre", "fantasia")
        duration = int(data.get("duration", 1))
        voice = data.get("voice", "pt-BR-AntonioNeural")
    else:
        input_type = request.form.get("type", "theme")
        genre = request.form.get("genre", "fantasia")
        duration = int(request.form.get("duration", 1))
        voice = request.form.get("voice", "pt-BR-AntonioNeural")

        if input_type == "pdf":
            if "file" not in request.files:
                return jsonify({"error": "Nenhum arquivo enviado"}), 400
            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "Nome do arquivo vazio"}), 400
                
            try:
                reader = PdfReader(file.stream)
                extracted_text = []
                for page in reader.pages:
                    text_page = page.extract_text()
                    if text_page:
                        extracted_text.append(text_page)
                content = "\n".join(extracted_text)
                if not content.strip():
                    return jsonify({"error": "Não foi possível extrair texto do PDF"}), 400
            except Exception as e:
                return jsonify({"error": f"Erro ao processar PDF: {str(e)}"}), 500
        else:
            content = request.form.get("content", "").strip()

    if not content:
        return jsonify({"error": "Conteúdo ou tema não especificado"}), 400

    try:
        username = session.get("username")
        narrative_data = run_in_background(generate_narrative_async(
            content=content,
            genre=genre,
            duration_min=duration,
            voice_id=voice,
            username=username
        ))
        return jsonify(narrative_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@narrative_bp.route("/api/narrative/tts")
def narrative_tts():
    text = request.args.get("text", "").strip()
    voice = request.args.get("voice", "").strip()
    if not text:
        return "Text is required", 400
    if not voice:
        voice = "pt-BR-AntonioNeural"

    try:
        import edge_tts
        
        async def gen():
            communicate = edge_tts.Communicate(text, voice)
            data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    data += chunk["data"]
            return data
            
        audio_data = run_in_background(gen())
        fp = io.BytesIO(audio_data)
        fp.seek(0)
        return send_file(fp, mimetype="audio/mpeg")
    except Exception as e:
        print(f"[Narrative TTS Error] {e}")
        return str(e), 500

@narrative_bp.route("/api/narrative/regenerate-thumbnail", methods=["POST"])
def regenerate_thumbnail():
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json() or {}
    title = data.get("title", "História")
    genre = data.get("genre", "fantasia")
    custom_prompt = data.get("custom_prompt", "").strip()
    username = session.get("username")
    
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
    
    from services.ai_service import generate_image_unified_async
    if custom_prompt:
        prompt = f"YouTube video thumbnail artwork showing: {custom_prompt}. ({style_modifier}, vibrant colors, textless, cinematic composition, award-winning illustration, 8k)"
    else:
        prompt = f"YouTube video thumbnail artwork for a story titled '{title}'. Genre: {genre}. ({style_modifier}, vibrant colors, textless, cinematic composition, award-winning illustration, 8k)"
        
    try:
        thumb_url, err = run_in_background(generate_image_unified_async(prompt, username=username))
        if err:
            return jsonify({"error": err}), 500
        return jsonify({"thumbnail_url": thumb_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
