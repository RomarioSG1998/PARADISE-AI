import os
from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
from services.ai_service import get_or_create_client_async, ENV_PATH
import services.ai_service
from utils.async_loop import run_in_background

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username")
        if username and username.strip():
            session["authenticated"] = True
            session["username"] = username.strip()
            return redirect(url_for("portal.index_hub"))
        else:
            error = "Por favor, insira o seu nome!"
    return render_template("login.html", error=error)

@auth_bp.route("/api/status", methods=["GET"])
def get_status():
    from dotenv import load_dotenv
    load_dotenv(ENV_PATH, override=True)
    secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
    secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    configured = bool((secure_1psid and secure_1psidts) or gemini_api_key)
    active = (services.ai_service.gemini_client is not None) or bool(gemini_api_key)
    
    return jsonify({
        "configured": configured,
        "active": active,
        "has_secure_1psid": bool(secure_1psid),
        "has_secure_1psidts": bool(secure_1psidts),
        "has_api_key": bool(gemini_api_key)
    })

@auth_bp.route("/api/save-cookies", methods=["POST"])
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
            services.ai_service.gemini_client = None
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to save credentials: {str(e)}"}), 500
