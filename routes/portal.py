import os
from flask import Blueprint, request, jsonify, render_template, Response, send_file, session, redirect, url_for
from services.ai_service import ENV_PATH, image_cache
from services.tts_service import generate_official_gemini_tts_async, pcm_to_wav, generate_edge_tts_async
from utils.async_loop import run_in_background
from dotenv import load_dotenv

portal_bp = Blueprint("portal", __name__)

@portal_bp.route("/")
def landing():
    if session.get("authenticated"):
        return redirect(url_for("portal.index_hub"))
    return render_template("landing.html")

@portal_bp.route("/hub")
def index_hub():
    if not session.get("authenticated"):
        return redirect(url_for("auth.login"))
    return render_template("hub.html")


@portal_bp.route("/api/image-cache/<img_id>")
def get_cached_image(img_id):
    if img_id in image_cache:
        return Response(image_cache[img_id], mimetype="image/jpeg")
    return "Image not found", 404


@portal_bp.route("/api/proxy-image")
def proxy_image():
    import os
    import requests
    from urllib.parse import urlparse
    from database import get_next_available_account
    
    url = request.args.get("url")
    if not url:
        return "URL is required", 400
        
    parsed = urlparse(url)
    if not any(domain in parsed.netloc for domain in ["googleusercontent.com", "google.com"]):
        return "Forbidden domain", 403

    # Force high-resolution for Google CDN images by removing low-res tags and appending =s1600
    import re
    if any(domain in parsed.netloc for domain in ["googleusercontent.com", "google.com"]):
        url_clean = re.sub(r'=[ws]\d+$', '', url)
        url_clean = re.sub(r'=s\d+$', '', url_clean)
        url_clean = re.sub(r'=s0$', '', url_clean)
        url = f"{url_clean}=s1600"

    try:
        username = session.get("username")
        account = get_next_available_account(username=username)
        
        cookies = {}
        psid = None
        psidts = None
        if account:
            psid = account["secure_1psid"]
            psidts = account["secure_1psidts"]
            cookies = {
                "__Secure-1PSID": psid,
                "__Secure-1PSIDTS": psidts
            }
        else:
            load_dotenv(ENV_PATH, override=True)
            psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
            psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
            if psid and psidts:
                cookies = {
                    "__Secure-1PSID": psid,
                    "__Secure-1PSIDTS": psidts
                }

        load_dotenv(ENV_PATH, override=True)
        cf_proxy = os.getenv("CLOUDFLARE_PROXY_URL", "").strip()

        if cf_proxy:
            import urllib.parse
            proxy_url = f"{cf_proxy}?url={urllib.parse.quote(url)}"
            if psid and psidts:
                proxy_url += f"&psid={urllib.parse.quote(psid)}&psidts={urllib.parse.quote(psidts)}"
            
            resp = requests.get(proxy_url, timeout=25)
        else:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            resp = requests.get(url, headers=headers, cookies=cookies, timeout=25)

        if resp.status_code != 200:
            print(f"[Paradise AI Proxy Image Error] Failed to fetch image: status={resp.status_code}, url={url}")
            return f"Failed to fetch image: status {resp.status_code}", 502
            
        content_type = resp.headers.get("Content-Type", "image/png")
        return Response(resp.content, mimetype=content_type)
    except Exception as e:
        return f"Error proxying image: {str(e)}", 500

@portal_bp.route("/api/tts")
def text_to_speech():
    text = request.args.get("text", "").strip()
    if not text:
        return "Text is required", 400
        
    lang_code = request.args.get("lang") or request.cookies.get("paradise_language", "pt")
    from services.tts_service import sanitize_tts_text, detect_language
    detected_lang = detect_language(text, default_lang=lang_code)
    text = sanitize_tts_text(text, detected_lang)
    
    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    # 1. Official Gemini API Audio Generation
    if gemini_api_key:
        try:
            print(f"[Paradise AI] Generating native voice from Gemini API (lang: {detected_lang})...")
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
        print(f"[Paradise AI] Generating Edge TTS voice (detected language: {detected_lang})...")
        audio_data = run_in_background(generate_edge_tts_async(text, detected_lang))
        
        fp = io.BytesIO(audio_data)
        fp.seek(0)
        return send_file(fp, mimetype="audio/mpeg")
    except Exception as e:
        print(f"[Paradise AI Edge-TTS Error] {str(e)}. Falling back to gTTS...")
        try:
            from gtts import gTTS
            import io
            
            gtts_lang = "en" if detected_lang == "en" else ("es" if detected_lang == "es" else "pt")
            gtts_tld = "com" if detected_lang == "en" else ("es" if detected_lang == "es" else "com.br")
            
            tts = gTTS(text=text, lang=gtts_lang, tld=gtts_tld)
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            return send_file(fp, mimetype="audio/mpeg")
        except Exception as ge:
            print(f"[Paradise AI TTS Error] Fallback failed: {str(ge)}")
            return f"Error generating TTS: {str(ge)}", 500

# Admin routes
@portal_bp.route("/admin")
def admin_dashboard():
    if not session.get("authenticated"):
        return redirect(url_for("auth.login"))
    return render_template("admin.html")

@portal_bp.route("/admin/api/apps", methods=["GET", "POST"])
def admin_apps():
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    from database import get_apps, create_app
    if request.method == "POST":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        if not name:
            return jsonify({"error": "App name is required"}), 400
        api_key = create_app(name)
        return jsonify({"api_key": api_key})
    return jsonify(get_apps())

@portal_bp.route("/admin/api/accounts", methods=["GET", "POST"])
def admin_accounts():
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    from database import get_accounts, add_account, delete_account
    if request.method == "POST":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        secure_1psid = data.get("secure_1psid", "").strip()
        secure_1psidts = data.get("secure_1psidts", "").strip()
        if not name or not secure_1psid or not secure_1psidts:
            return jsonify({"success": False, "error": "Preencha todos os campos!"}), 400
        
        # Add account
        add_account(None, name, secure_1psid, secure_1psidts)
        
        # Test account
        from gemini_webapi import GeminiClient
        from gemini_webapi.client import AccountStatus
        try:
            client = GeminiClient(secure_1psid, secure_1psidts)
            run_in_background(client.init())
            if client.account_status != AccountStatus.AVAILABLE:
                accounts = get_accounts()
                if accounts:
                    delete_account(accounts[0]["id"])
                return jsonify({"success": False, "error": f"Erro de autenticação: {client.account_status.description}"})
            return jsonify({"success": True})
        except Exception as e:
            accounts = get_accounts()
            if accounts:
                delete_account(accounts[0]["id"])
            return jsonify({"success": False, "error": f"Erro de conexão: {str(e)}"})
            
    return jsonify(get_accounts())

@portal_bp.route("/admin/api/accounts/<account_id>", methods=["DELETE"])
def admin_delete_account(account_id):
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    from database import delete_account
    delete_account(account_id)
    return jsonify({"success": True})

@portal_bp.route("/admin/api/stats")
def admin_stats():
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    from database import get_stats
    return jsonify(get_stats())
