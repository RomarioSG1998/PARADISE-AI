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
    if gemini_client is not None and not force_reinit:
        return gemini_client, None

    # Load fresh env vars
    load_dotenv(ENV_PATH, override=True)
    secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
    secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()

    if not secure_1psid or not secure_1psidts:
        gemini_client = None
        return None, "Cookies are not configured. Please set GEMINI_SECURE_1PSID and GEMINI_SECURE_1PSIDTS."

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

async def chat_async(message):
    client, err = await get_or_create_client_async()
    if err:
        return None, err, True

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
    allowed_routes = ["login", "static"]
    if request.endpoint and request.endpoint not in allowed_routes:
        if not session.get("authenticated"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized. Please authenticate first."}), 401
            return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        password = request.form.get("password")
        if password == "vilmika":
            session["authenticated"] = True
            return redirect(url_for("index_hub"))
        else:
            error = "Senha incorreta!"
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
    
    configured = bool(secure_1psid and secure_1psidts)
    active = gemini_client is not None
    
    return jsonify({
        "configured": configured,
        "active": active,
        "has_secure_1psid": bool(secure_1psid),
        "has_secure_1psidts": bool(secure_1psidts)
    })

@app.route("/api/save-cookies", methods=["POST"])
def save_cookies():
    data = request.get_json() or {}
    secure_1psid = data.get("secure_1psid", "").strip()
    secure_1psidts = data.get("secure_1psidts", "").strip()

    if not secure_1psid or not secure_1psidts:
        return jsonify({"success": False, "error": "Both cookies are required"}), 400

    try:
        with open(ENV_PATH, "w") as f:
            f.write(f"GEMINI_SECURE_1PSID={secure_1psid}\n")
            f.write(f"GEMINI_SECURE_1PSIDTS={secure_1psidts}\n")
        
        # Reiniciar o cliente no loop de segundo plano
        client, err = run_in_background(get_or_create_client_async(force_reinit=True))
        if err:
            return jsonify({"success": False, "error": err}), 400
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to save cookies: {str(e)}"}), 500

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

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

# ----------------- BOOK GENERATOR ENDPOINTS -----------------

async def generate_book_async(theme, level, language):
    client, err = await get_or_create_client_async()
    if err:
        return None, err
        
    prompt = f"""Escreva um livro curto personalizado no seguinte formato JSON. O livro deve ser escrito no idioma "{language}", com nível de leitura "{level}" e sobre o tema "{theme}".
O JSON retornado deve seguir exatamente esta estrutura:
{{
  "title": "Título do Livro",
  "theme": "Tema",
  "level": "Nível",
  "language": "Idioma",
  "chapters": [
    {{
      "chapter_number": 1,
      "title": "Título do Capítulo 1",
      "text": "Texto completo do Capítulo 1 (narrativa rica e envolvente de 3 a 5 parágrafos).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 1 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }},
    {{
      "chapter_number": 2,
      "title": "Título do Capítulo 2",
      "text": "Texto completo do Capítulo 2 (narrativa rica e envolvente de 3 a 5 parágrafos).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 2 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }},
    {{
      "chapter_number": 3,
      "title": "Título do Capítulo 3",
      "text": "Texto completo do Capítulo 3 (conclusão rica e emocionante de 3 a 5 parágrafos).",
      "illustration_prompt": "Highly detailed English prompt describing the visual scene of Chapter 3 for a high-quality image generator. Style should be clean, digital art, storybook illustration, no text in the image."
    }}
  ]
}}
Retorne APENAS o bloco JSON válido. Não inclua nenhuma introdução, marcação adicional ou texto fora do bloco de código json. Envolva o JSON em um bloco de código markdown (iniciando com ```json e finalizando com ```)."""

    try:
        response = await client.generate_content(prompt)
        text_resp = response.text if hasattr(response, "text") else str(response)
        
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
            
            try:
                img_response = await client.generate_content(full_img_prompt)
                if hasattr(img_response, "images") and img_response.images:
                    for img in img_response.images:
                        if hasattr(img, "url") and img.url:
                            chapter["image_url"] = img.url
                            break
                    else:
                        chapter["image_error"] = "Nenhuma imagem válida encontrada no retorno do Gemini."
                else:
                    err_msg = img_response.text if hasattr(img_response, "text") and img_response.text else "Nenhuma imagem retornada pelo Gemini."
                    chapter["image_error"] = err_msg
            except Exception as img_err:
                print(f"[Book Gen Error] Failed to generate image for chapter {idx+1}: {img_err}")
                chapter["image_error"] = str(img_err)
                
        return book_data, None
    except Exception as e:
        return None, f"Failed to generate book: {str(e)}"

async def illustrate_scene_async(prompt):
    client, err = await get_or_create_client_async()
    if err:
        return None, err
        
    full_prompt = f"Gere uma imagem de: {prompt}. (2D cartoon style illustration, thick outlines, vibrant colors, comic drawing style, playful animation art, no text, no letters)"
    try:
        img_response = await client.generate_content(full_prompt)
        if hasattr(img_response, "images") and img_response.images:
            for img in img_response.images:
                if hasattr(img, "url") and img.url:
                    return {"image_url": img.url}, None
        
        err_msg = img_response.text if hasattr(img_response, "text") and img_response.text else "Nenhuma imagem retornada pelo Gemini."
        return None, err_msg
    except Exception as e:
        return None, f"Falha na geração da ilustração: {str(e)}"

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
    client, err = await get_or_create_client_async()
    if err:
        return None, err
        
    prompt = f"""Explique a palavra ou expressão "{word}" que aparece na seguinte frase: "{sentence}".
O livro está escrito no idioma {book_lang}.
Retorne a resposta EXCLUSIVAMENTE em formato JSON (envolvido por ```json ... ```) seguindo exatamente este modelo:
{{
  "word": "{word}",
  "translation": "Tradução direta da palavra/expressão para o idioma {target_lang}",
  "explanation": "Explicação simples e breve de 1 frase sobre o significado no contexto da história.",
  "illustration_prompt": "A simple 2D cartoon vector icon of {word}, white background, colorful, clean outlines, child friendly, clip art style"
}}
Não adicione explicações extras fora do bloco JSON. Retorne apenas o JSON válido."""

    try:
        response = await client.generate_content(prompt)
        text_resp = response.text if hasattr(response, "text") else str(response)
        
        import json
        cleaned_text = text_resp.strip()
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
            
        data = json.loads(cleaned_text)
        
        # Generate the micro-illustration for this word!
        img_prompt = data.get("illustration_prompt", f"A simple vector cartoon icon of {word}")
        img_url = None
        try:
            img_response = await client.generate_content(img_prompt)
            if hasattr(img_response, "images") and img_response.images:
                for img in img_response.images:
                    if hasattr(img, "url") and img.url:
                        img_url = img.url
                        break
        except Exception as img_err:
            print(f"[Word Gen Error] Failed to generate micro-illustration: {img_err}")
            
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
        
    target_lang = "Português" if book_lang != "Português" else "Inglês"
    
    result, err = run_in_background(explain_word_async(word, sentence, book_lang, target_lang))
    if err:
        return jsonify({"error": err}), 500
        
    return jsonify(result)

if __name__ == "__main__":
    # Pre-initialize client on boot if cookies exist
    try:
        run_in_background(get_or_create_client_async())
    except Exception:
        pass
        
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
