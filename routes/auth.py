import os
from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
from services.ai_service import get_or_create_client_async, ENV_PATH
import services.ai_service
from utils.async_loop import run_in_background

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if session.get("authenticated"):
        return redirect(url_for("portal.index_hub"))
        
    error = None
    if request.method == "POST":
        username_or_email = request.form.get("username_or_email", "").strip()
        password = request.form.get("password", "").strip()
        
        if not username_or_email or not password:
            error = "Preencha o e-mail/usuário e a senha!"
        else:
            from database import authenticate_user
            user = authenticate_user(username_or_email, password)
            if user:
                session["authenticated"] = True
                session["username"] = user["username"]
                return redirect(url_for("portal.index_hub"))
            else:
                error = "Usuário, e-mail ou senha incorretos!"
    return render_template("login.html", error=error)

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if session.get("authenticated"):
        return redirect(url_for("portal.index_hub"))
        
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "").strip()
        full_name = request.form.get("full_name", "").strip()
        
        if not username or not email or not password:
            error = "Todos os campos obrigatórios (* ) devem ser preenchidos!"
        else:
            try:
                from database import register_user
                register_user(username, email, password, full_name or username)
                session["authenticated"] = True
                session["username"] = username
                return redirect(url_for("portal.index_hub"))
            except Exception as e:
                error = str(e)
    return render_template("register.html", error=error)

@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("portal.landing"))

@auth_bp.route("/api/status", methods=["GET"])
def get_status():
    from dotenv import load_dotenv
    from database import get_accounts
    
    load_dotenv(ENV_PATH, override=True)
    secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
    secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    username = session.get("username")
    user_key = username if username else "default"
    
    try:
        accounts = get_accounts()
        # Filter: count accounts that are associated with this user or are shared
        user_accounts = [acc for acc in accounts if acc.get("username") == username or acc.get("username") is None]
        has_db_accounts = len(user_accounts) > 0
        has_active_db_accounts = any(acc["status"] == "active" for acc in user_accounts)
    except Exception:
        has_db_accounts = False
        has_active_db_accounts = False
    
    configured = bool((secure_1psid and secure_1psidts) or gemini_api_key or has_db_accounts)
    active_client = services.ai_service.gemini_clients.get(user_key)
    active = (active_client is not None) or bool(gemini_api_key) or has_active_db_accounts
    
    return jsonify({
        "configured": configured,
        "active": active,
        "has_secure_1psid": bool(secure_1psid) or has_db_accounts,
        "has_secure_1psidts": bool(secure_1psidts) or has_db_accounts,
        "has_api_key": bool(gemini_api_key)
    })

@auth_bp.route("/api/save-cookies", methods=["POST"])
def save_cookies():
    username = session.get("username")
    if not username:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
        
    data = request.get_json() or {}
    secure_1psid = data.get("secure_1psid", "").strip()
    secure_1psidts = data.get("secure_1psidts", "").strip()
    gemini_api_key = data.get("gemini_api_key", "").strip()
    provider = data.get("provider", "gemini").strip()

    if provider == "gemini":
        if not gemini_api_key and (not secure_1psid or not secure_1psidts):
            return jsonify({"success": False, "error": "Forneça a API Key ou ambos os cookies"}), 400
    elif provider == "copilot":
        if not secure_1psid:
            return jsonify({"success": False, "error": "O cookie _U é obrigatório para o Copilot"}), 400

    try:
        from database import add_account
        
        # Reset current cache for this specific user
        import services.ai_service
        user_key = username
        services.ai_service.gemini_clients[user_key] = None
        services.ai_service.current_account_ids[user_key] = None

        # Update .env safely preserving DATABASE_URL etc.
        updates = {}
        if gemini_api_key:
            updates["GEMINI_API_KEY"] = gemini_api_key
            remove_keys = ["GEMINI_SECURE_1PSID", "GEMINI_SECURE_1PSIDTS"]
        else:
            # Save account to DB pool associated with user
            from datetime import datetime
            account_name = f"{provider.capitalize()} de {username} ({datetime.now().strftime('%d/%m/%Y %H:%M')})"
            add_account(username, account_name, secure_1psid, secure_1psidts, provider)
            
            updates["GEMINI_SECURE_1PSID"] = secure_1psid
            updates["GEMINI_SECURE_1PSIDTS"] = secure_1psidts
            remove_keys = ["GEMINI_API_KEY"]

        # Read current env
        existing = {}
        if os.path.exists(ENV_PATH):
            with open(ENV_PATH, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        parts = line.split("=", 1)
                        if len(parts) == 2:
                            existing[parts[0].strip()] = parts[1].strip()

        # Remove key exclusions
        for rk in remove_keys:
            existing.pop(rk, None)

        # Apply new variables
        for k, v in updates.items():
            existing[k] = v

        # Write safely back to .env
        with open(ENV_PATH, "w") as f:
            for k, v in existing.items():
                f.write(f"{k}={v}\n")
        
        # Test connection for this user
        if not gemini_api_key and provider == "gemini":
            client, err = run_in_background(get_or_create_client_async(username=username, force_reinit=True))
            if err:
                return jsonify({"success": False, "error": err}), 400
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to save credentials: {str(e)}"}), 500

@auth_bp.route("/api/profile", methods=["GET", "POST"])
def manage_profile():
    username = session.get("username")
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
        
    from database import get_profile, save_profile
    
    if request.method == "GET":
        try:
            profile = get_profile(username)
            if not profile:
                profile = {
                    "username": username,
                    "full_name": username,
                    "email": "",
                    "language": "pt",
                    "avatar_name": "Professor",
                    "avatar_image_url": ""
                }
            return jsonify(profile)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    else: # POST
        data = request.get_json() or {}
        full_name = data.get("full_name", "").strip() or username
        email = data.get("email", "").strip()
        language = data.get("language", "pt").strip()
        avatar_name = data.get("avatar_name", "Professor").strip()
        avatar_image_url = data.get("avatar_image_url", "").strip()
        
        if language not in ["pt", "en", "es"]:
            language = "pt"
            
        try:
            save_profile(username, full_name, email, language, avatar_name, avatar_image_url)
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

