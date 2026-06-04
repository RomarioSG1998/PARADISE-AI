import os
from flask import Blueprint, request, jsonify, render_template, Response, send_file
from services.ai_service import chat_async, ENV_PATH, image_cache
from services.tts_service import generate_official_gemini_tts_async, pcm_to_wav, generate_edge_tts_async
from utils.async_loop import run_in_background
from dotenv import load_dotenv

portal_bp = Blueprint("portal", __name__)

@portal_bp.route("/")
def index_hub():
    return render_template("hub.html")

@portal_bp.route("/chat")
def index_chat():
    return render_template("chat.html")

@portal_bp.route("/api/image-cache/<img_id>")
def get_cached_image(img_id):
    if img_id in image_cache:
        return Response(image_cache[img_id], mimetype="image/jpeg")
    return "Image not found", 404

@portal_bp.route("/api/chat", methods=["POST"])
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

@portal_bp.route("/api/proxy-image")
def proxy_image():
    import requests
    from urllib.parse import urlparse
    
    url = request.args.get("url")
    if not url:
        return "URL is required", 400
        
    parsed = urlparse(url)
    if not any(domain in parsed.netloc for domain in ["googleusercontent.com", "google.com"]):
        return "Forbidden domain", 403

    try:
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

@portal_bp.route("/api/tts")
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
                fp = io.BytesIO(audio_data)
                fp.seek(0)
                return send_file(fp, mimetype=mime_type)
        except Exception as e:
            print(f"[Paradise AI] Native Gemini TTS failed: {str(e)}. Falling back to Edge TTS...")

    # 2. Edge TTS Fallback
    try:
        import io
        audio_data = run_in_background(generate_edge_tts_async(text, lang_code))
        
        fp = io.BytesIO(audio_data)
        fp.seek(0)
        return send_file(fp, mimetype="audio/mpeg")
    except Exception as e:
        print(f"[Paradise AI Edge-TTS Error] {str(e)}. Falling back to gTTS...")
        try:
            from gtts import gTTS
            import io
            
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
