import os
import asyncio
import threading
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(ENV_PATH, override=True)

app = Flask(__name__, template_folder="templates")
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.secret_key = os.getenv("FLASK_SECRET_KEY", "super-secret-key-12345-vilmika")

# 1. Setup a dedicated event loop in a background thread for thread-safe Async calls
_loop = asyncio.new_event_loop()

def _start_background_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

_thread = threading.Thread(target=_start_background_loop, args=(_loop,), daemon=True)
_thread.start()

def run_in_background(coro):
    """Executes a coroutine in the background loop and blocks for the result."""
    future = asyncio.run_coroutine_threadsafe(coro, _loop)
    return future.result()

# Global client cache
gemini_client = None

async def get_or_create_client_async(force_reinit=False):
    global gemini_client
    
    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_api_key:
        return "api_key", None
        
    if gemini_client is not None and not force_reinit:
        return gemini_client, None

    secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
    secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()

    if not secure_1psid or not secure_1psidts:
        gemini_client = None
        return None, "Configuração ausente: defina GEMINI_API_KEY ou os cookies GEMINI_SECURE_1PSID e GEMINI_SECURE_1PSIDTS."

    try:
        from gemini_webapi import GeminiClient
        from gemini_webapi.client import AccountStatus
        print("[Paradise AI] Initializing GeminiClient inside background loop...")
        client = GeminiClient(secure_1psid, secure_1psidts)
        await client.init()
        if client.account_status != AccountStatus.AVAILABLE:
            gemini_client = None
            return None, f"Authentication failed: {client.account_status.description}"
        gemini_client = client
        print("[Paradise AI] Client initialized successfully!")
        return gemini_client, None
    except Exception as e:
        gemini_client = None
        return None, f"Failed to initialize client: {str(e)}"

def enhance_prompt_for_images(message: str) -> str:
    msg_lower = message.lower()
    image_keywords = ["gere uma imagem", "gerar imagem", "crie uma imagem", "criar imagem", "desenhe", "faça um desenho", "generate an image", "create an image", "picture of", "photo of"]
    
    if any(kw in msg_lower for kw in image_keywords):
        enhancement = (
            "\n\n(Important System Instruction for Image Generation: As this is a request to generate an image, "
            "please produce a high-quality, ultra-detailed photorealistic image. Expand the user's request "
            "into a rich, descriptive prompt for your internal ImageFx/Imagen 3 generator. Explicitly request "
            "highly detailed textures, professional cinematic lighting, 8k resolution, photorealism, deep colors, "
            "and award-winning photographic framing. Do not output generic low-resolution, blurred, or illustration-like "
            "styles unless explicitly requested by the user.)"
        )
        return message + enhancement
    return message

image_cache = {}

@app.route("/api/image-cache/<img_id>")
def get_cached_image(img_id):
    from flask import Response
    if img_id in image_cache:
        return Response(image_cache[img_id], mimetype="image/jpeg")
    return "Image not found", 404

async def generate_text_unified_async(prompt):
    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    if gemini_api_key:
        from google import genai
        official_client = genai.Client(api_key=gemini_api_key)
        # Use gemini-2.5-flash for text generation tasks
        response = official_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        text = response.text if hasattr(response, "text") else str(response)
        return text, None
        
    client, err = await get_or_create_client_async()
    if err:
        return None, err
    try:
        response = await client.generate_content(prompt)
        text = response.text if hasattr(response, "text") else str(response)
        return text, None
    except Exception as e:
        return None, str(e)

async def generate_image_unified_async(prompt):
    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    if gemini_api_key:
        try:
            from google import genai
            official_client = genai.Client(api_key=gemini_api_key)
            print(f"[Paradise AI] Generating image via Imagen 3: {prompt}")
            result = official_client.models.generate_images(
                model='imagen-3.0-generate-002',
                prompt=prompt,
                config=dict(
                    number_of_images=1,
                    output_mime_type="image/jpeg"
                )
            )
            if result.generated_images:
                import uuid
                img_bytes = result.generated_images[0].image.image_bytes
                img_id = str(uuid.uuid4())
                image_cache[img_id] = img_bytes
                return f"/api/image-cache/{img_id}", None
            return None, "Nenhuma imagem foi retornada pelo modelo Imagen 3."
        except Exception as e:
            return None, f"Erro de geração de imagem oficial: {str(e)}"
            
    client, err = await get_or_create_client_async()
    if err:
        return None, err
    try:
        response = await client.generate_content(prompt)
        if hasattr(response, "images") and response.images:
            for img in response.images:
                if hasattr(img, "url") and img.url:
                    return img.url, None
        return None, "Nenhuma imagem retornada pelo cliente."
    except Exception as e:
        return None, str(e)

async def chat_async(message):
    client, err = await get_or_create_client_async()
    if err:
        return None, err, True

    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if gemini_api_key:
        try:
            from google import genai
            print("[Paradise AI] Using official Gemini API for chat...")
            official_client = genai.Client(api_key=gemini_api_key)
            response = official_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=message
            )
            text = response.text if hasattr(response, "text") else str(response)
            return {"text": text, "images": []}, None, False
        except Exception as e:
            return None, f"Official Gemini API Error: {str(e)}", False

    try:
        # Enhance prompt if it contains image generation requests
        enhanced_message = enhance_prompt_for_images(message)
        response = await client.generate_content(enhanced_message)
        
        # Parse images if any
        images = []
        if hasattr(response, "images") and response.images:
            for img in response.images:
                if hasattr(img, "url") and img.url:
                    images.append(img.url)

        text = response.text if hasattr(response, "text") else str(response)
        return {"text": text, "images": images}, None, False
    except Exception as e:
        error_msg = str(e)
        print(f"[Paradise AI Error] {error_msg}")
        
        needs_config = False
        if "cookie" in error_msg.lower() or "auth" in error_msg.lower() or "401" in error_msg or "403" in error_msg:
            global gemini_client
            gemini_client = None
            needs_config = True
            
        return None, f"An error occurred: {error_msg}", needs_config

# ----------------- AUTHENTICATION HOOK & ROUTE -----------------

@app.before_request
def check_auth():
    allowed_routes = ["login", "static", "get_status"]
    if request.endpoint and request.endpoint not in allowed_routes:
        if not session.get("authenticated"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized. Please authenticate first."}), 401
            return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username")
        if username and username.strip():
            session["authenticated"] = True
            session["username"] = username.strip()
            return redirect(url_for("index_hub"))
        else:
            error = "Por favor, insira o seu nome!"
    return render_template("login.html", error=error)

# ----------------- PORTAL ROUTES -----------------

@app.route("/")
def index_hub():
    # Renders the main App Hub Dashboard
    return render_template("hub.html")

@app.route("/chat")
def index_chat():
    # Renders the Chat Pro App
    return render_template("chat.html")

@app.route("/api/status", methods=["GET"])
def get_status():
    load_dotenv(ENV_PATH, override=True)
    secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
    secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    configured = bool((secure_1psid and secure_1psidts) or gemini_api_key)
    active = (gemini_client is not None) or bool(gemini_api_key)
    
    return jsonify({
        "configured": configured,
        "active": active,
        "has_secure_1psid": bool(secure_1psid),
        "has_secure_1psidts": bool(secure_1psidts),
        "has_api_key": bool(gemini_api_key)
    })

@app.route("/api/save-cookies", methods=["POST"])
def save_cookies():
    data = request.get_json() or {}
    secure_1psid = data.get("secure_1psid", "").strip()
    secure_1psidts = data.get("secure_1psidts", "").strip()
    gemini_api_key = data.get("gemini_api_key", "").strip()

    if not gemini_api_key and (not secure_1psid or not secure_1psidts):
        return jsonify({"success": False, "error": "Forneça a API Key ou ambos os cookies"}), 400

    try:
        with open(ENV_PATH, "w") as f:
            if gemini_api_key:
                f.write(f"GEMINI_API_KEY={gemini_api_key}\n")
            else:
                f.write(f"GEMINI_SECURE_1PSID={secure_1psid}\n")
                f.write(f"GEMINI_SECURE_1PSIDTS={secure_1psidts}\n")
        
        if not gemini_api_key:
            client, err = run_in_background(get_or_create_client_async(force_reinit=True))
            if err:
                return jsonify({"success": False, "error": err}), 400
        else:
            global gemini_client
            gemini_client = None
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to save credentials: {str(e)}"}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    
    if not message:
        return jsonify({"error": "Message is required"}), 400

    result, err, needs_config = run_in_background(chat_async(message))
    
    if err:
        code = 401 if needs_config else 500
        return jsonify({"error": err, "needs_config": needs_config}), code

    return jsonify(result)

@app.route("/api/proxy-image")
def proxy_image():
    import requests
    from urllib.parse import urlparse
    from flask import Response
    
    url = request.args.get("url")
    if not url:
        return "URL is required", 400
        
    parsed = urlparse(url)
    if not any(domain in parsed.netloc for domain in ["googleusercontent.com", "google.com"]):
        return "Forbidden domain", 403

    try:
        # Load fresh cookies to authorize Google user content download
        load_dotenv(ENV_PATH, override=True)
        secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
        secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
        
        cookies = {}
        if secure_1psid and secure_1psidts:
            cookies = {
                "__Secure-1PSID": secure_1psid,
                "__Secure-1PSIDTS": secure_1psidts
            }

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, cookies=cookies, timeout=25)
        if resp.status_code != 200:
            print(f"[Paradise AI Proxy Image Error] Failed to fetch image: status={resp.status_code}, url={url}")
            return f"Failed to fetch image from Google: status {resp.status_code}", 502
            
        content_type = resp.headers.get("Content-Type", "image/png")
        return Response(resp.content, mimetype=content_type)
    except Exception as e:
        return f"Error proxying image: {str(e)}", 500

async def generate_official_gemini_tts_async(text: str, api_key: str) -> tuple[bytes, str]:
    from google import genai
    from google.genai import types
    
    client = genai.Client(api_key=api_key)
    
    # We choose "Puck" as the native Gemini male assistant voice (highly natural)
    config = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Puck"
                )
            )
        )
    )
    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"Leia este texto com a entonação correta do robô: {text}",
        config=config
    )
    
    audio_bytes = b""
    mime_type = "audio/wav"
    
    if response.candidates and response.candidates[0].content.parts:
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                if part.inline_data.data:
                    audio_bytes += part.inline_data.data
                if part.inline_data.mime_type:
                    mime_type = part.inline_data.mime_type
                    
    return audio_bytes, mime_type

def pcm_to_wav(pcm_data, sample_rate=24000, num_channels=1, sample_width=2):
    import io
    import wave
    wav_buf = io.BytesIO()
    with wave.open(wav_buf, 'wb') as wav_file:
        wav_file.setnchannels(num_channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    wav_buf.seek(0)
    return wav_buf.read()

async def generate_edge_tts_async(text: str, lang_code: str = "pt") -> bytes:
    import edge_tts
    if lang_code == "en":
        voice = "en-US-EmmaNeural"
    elif lang_code == "es":
        voice = "es-ES-ElviraNeural"
    else:
        # AntonioNeural is a highly natural, male Portuguese voice matching a premium virtual assistant
        voice = "pt-BR-AntonioNeural"
        
    communicate = edge_tts.Communicate(text, voice)
    data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            data += chunk["data"]
    return data

@app.route("/api/tts")
def text_to_speech():
    text = request.args.get("text", "").strip()
    if not text:
        return "Text is required", 400
        
    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    lang_code = request.cookies.get("paradise_language", "pt")
    
    # 1. Official Gemini API Audio Generation
    if gemini_api_key:
        try:
            print("[Paradise AI] Generating native voice from Gemini API...")
            audio_data, mime_type = run_in_background(generate_official_gemini_tts_async(text, gemini_api_key))
            
            if audio_data:
                if "pcm" in mime_type.lower():
                    audio_data = pcm_to_wav(audio_data)
                    mime_type = "audio/wav"
                
                import io
                from flask import send_file
                fp = io.BytesIO(audio_data)
                fp.seek(0)
                return send_file(fp, mimetype=mime_type)
        except Exception as e:
            print(f"[Paradise AI] Native Gemini TTS failed: {str(e)}. Falling back to Edge TTS...")

    # 2. Edge TTS Fallback
    try:
        import io
        from flask import send_file
        
        # Generate neural speech in background event loop
        audio_data = run_in_background(generate_edge_tts_async(text, lang_code))
        
        fp = io.BytesIO(audio_data)
        fp.seek(0)
        return send_file(fp, mimetype="audio/mpeg")
    except Exception as e:
        print(f"[Paradise AI Edge-TTS Error] {str(e)}. Falling back to gTTS...")
        try:
            from gtts import gTTS
            import io
            from flask import send_file
            
            gtts_lang = "en" if lang_code == "en" else ("es" if lang_code == "es" else "pt")
            gtts_tld = "com" if lang_code == "en" else ("es" if lang_code == "es" else "com.br")
            
            tts = gTTS(text=text, lang=gtts_lang, tld=gtts_tld)
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            return send_file(fp, mimetype="audio/mpeg")
        except Exception as ge:
            print(f"[Paradise AI TTS Error] Fallback failed: {str(ge)}")
            return f"Error generating TTS: {str(ge)}", 500


@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

# ----------------- BOOK GENERATOR ENDPOINTS -----------------

async def generate_book_async(theme, level, language):
    lang_lower = language.lower()
    print(f"[Paradise AI] Generating book. Theme: '{theme}', Level: '{level}', Target Language: '{language}'")
    
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

    text_resp, err = await generate_text_unified_async(prompt)
    if err:
        return None, err
        
    try:
        # Clean and parse JSON
        import json
        book_data = {}
        cleaned_text = text_resp.strip()
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
            
        book_data = json.loads(cleaned_text)
        
        # For each chapter, generate the corresponding image in cartoon style
        for idx, chapter in enumerate(book_data.get("chapters", [])):
            img_prompt = chapter.get("illustration_prompt", f"A beautiful scene depicting {theme}")
            full_img_prompt = f"Gere uma imagem de: {img_prompt}. (2D cartoon style illustration, thick outlines, vibrant colors, comic drawing style, playful animation art, no text, no letters, no labels)"
            
            img_url, img_err = await generate_image_unified_async(full_img_prompt)
            if img_url:
                chapter["image_url"] = img_url
            else:
                chapter["image_error"] = img_err or "Nenhuma imagem retornada"
                
        return book_data, None
    except Exception as e:
        return None, f"Failed to generate book: {str(e)}"

async def illustrate_scene_async(prompt):
    full_prompt = f"Gere uma imagem de: {prompt}. (2D cartoon style illustration, thick outlines, vibrant colors, comic drawing style, playful animation art, no text, no letters)"
    img_url, img_err = await generate_image_unified_async(full_prompt)
    if img_url:
        return {"image_url": img_url}, None
    return None, img_err or "Nenhuma imagem retornada"

@app.route("/book")
def index_book():
    # Renders the Book Generator App
    return render_template("book.html")

@app.route("/api/book/generate", methods=["POST"])
def generate_book():
    data = request.get_json() or {}
    theme = data.get("theme", "").strip()
    level = data.get("level", "").strip()
    language = data.get("language", "").strip()
    
    if not theme or not level or not language:
        return jsonify({"error": "Theme, level, and language are required"}), 400

    result, err = run_in_background(generate_book_async(theme, level, language))
    if err:
        return jsonify({"error": err}), 500
        
    return jsonify(result)

@app.route("/api/book/illustrate-scene", methods=["POST"])
def illustrate_scene():
    data = request.get_json() or {}
    prompt = data.get("prompt", "").strip()
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
        
    result, err = run_in_background(illustrate_scene_async(prompt))
    if err:
        return jsonify({"error": err}), 500
        
    return jsonify(result)

async def explain_word_async(word, sentence, book_lang, target_lang):
    prompt = f"""Explique a palavra ou expressão "{word}" que aparece na seguinte frase: "{sentence}".
O livro está escrito no idioma {book_lang}.
O JSON retornado deve seguir exatamente este modelo:
{{
  "word": "{word}",
  "translation": "Tradução direta da palavra/expressão para o idioma {target_lang}",
  "explanation": "Explicação simples e breve de 1 frase sobre o significado no contexto da história.",
  "illustration_prompt": "A simple 2D cartoon vector icon of {word}, white background, colorful, clean outlines, child friendly, clip art style"
}}
Não adicione explicações extras fora do bloco JSON. Retorne apenas o JSON válido."""

    text_resp, err = await generate_text_unified_async(prompt)
    if err:
        return None, err
        
    try:
        import json
        cleaned_text = text_resp.strip()
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
            
        data = json.loads(cleaned_text)
        
        # Generate the micro-illustration for this word!
        img_prompt = data.get("illustration_prompt", f"A simple vector cartoon icon of {word}")
        img_url, img_err = await generate_image_unified_async(img_prompt)
        
        data["image_url"] = img_url
        return data, None
    except Exception as e:
        return None, f"Failed to explain word: {str(e)}"

@app.route("/api/book/explain-word", methods=["POST"])
def explain_word():
    data = request.get_json() or {}
    word = data.get("word", "").strip()
    sentence = data.get("sentence", "").strip()
    book_lang = data.get("book_language", "").strip()
    
    if not word or not sentence or not book_lang:
        return jsonify({"error": "Word, sentence, and book language are required"}), 400
        
    lang_code = request.cookies.get("paradise_language", "pt")
    lang_names = {
        "pt": "Português",
        "en": "Inglês",
        "es": "Espanhol"
    }
    target_lang = lang_names.get(lang_code, "Português")
    
    result, err = run_in_background(explain_word_async(word, sentence, book_lang, target_lang))
    if err:
        return jsonify({"error": err}), 500
        
    return jsonify(result)

# ----------------- CLASSROOM ENDPOINTS -----------------

@app.route("/classroom")
def index_classroom():
    # Renders the Classroom App
    return render_template("classroom.html")

@app.route("/api/classroom/generate", methods=["POST"])
def generate_classroom():
    import json
    
    # We can handle text inputs or PDF file uploads
    input_type = "theme"
    content = ""
    
    if request.is_json:
        data = request.get_json() or {}
        input_type = data.get("type", "theme")
        content = data.get("content", "").strip()
    else:
        input_type = request.form.get("type", "theme")
        if input_type == "pdf":
            if "file" not in request.files:
                return jsonify({"error": "Nenhum arquivo enviado"}), 400
            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "Nome do arquivo vazio"}), 400
                
            try:
                from pypdf import PdfReader
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
        
    # Retrieve lang_code from form/json or cookies
    lang_code = "pt"
    if request.is_json:
        data = request.get_json() or {}
        lang_code = data.get("language") or request.cookies.get("paradise_language", "pt")
    else:
        lang_code = request.form.get("language") or request.cookies.get("paradise_language", "pt")

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
    text_resp, err = run_in_background(generate_text_unified_async(prompt))
    if err:
        return jsonify({"error": f"Falha ao gerar roteiro da aula: {err}"}), 500
        
    try:
        cleaned_text = text_resp.strip()
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
            
        lesson_data = json.loads(cleaned_text)
    except Exception as parse_err:
        print(f"[Classroom Parser Error] {parse_err}. Response text was: {text_resp}")
        return jsonify({"error": "Erro ao interpretar resposta do modelo. Tente novamente."}), 500

    # Generate illustrations for slides in background
    slides = lesson_data.get("slides", [])
    for idx, slide in enumerate(slides):
        img_prompt = slide.get("image_prompt", f"A technical chalkboard drawing about {lesson_data.get('subject', 'education')}")
        # Inject standard style modifiers to guarantee nice classroom drawings
        full_img_prompt = f"Gere uma imagem de: {img_prompt}. (white chalk sketch on blackboard, blackboard drawing style, schematic, educational blueprint, dark green board background, technical drawing, no letters, no text, outline drawing)"
        
        img_url, img_err = run_in_background(generate_image_unified_async(full_img_prompt))
        if img_url:
            slide["image_url"] = img_url
        else:
            slide["image_error"] = img_err or "Nenhuma imagem retornada"

    return jsonify(lesson_data)

if __name__ == "__main__":
    # Pre-initialize client on boot if cookies exist
    try:
        run_in_background(get_or_create_client_async())
    except Exception:
        pass
        
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
