import os
from flask import Flask, request, jsonify, redirect, url_for, session
from dotenv import load_dotenv

# Blueprints
from routes.auth import auth_bp
from routes.book import book_bp
from routes.classroom import classroom_bp
from routes.portal import portal_bp
from routes.narrative import narrative_bp

# Async manager
from utils.async_loop import run_in_background
from services.ai_service import get_or_create_client_async, ENV_PATH

# Initialize Database
from database import init_db
init_db()

app = Flask(__name__, template_folder="templates")
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.secret_key = os.getenv("FLASK_SECRET_KEY", "super-secret-key-12345-vilmika")

# Register Blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(book_bp)
app.register_blueprint(classroom_bp)
app.register_blueprint(portal_bp)
app.register_blueprint(narrative_bp)

@app.before_request
def check_auth():
    allowed_routes = ["auth.login", "auth.register", "auth.logout", "static", "auth.get_status", "auth.save_cookies", "portal.landing"]
    if request.endpoint and request.endpoint not in allowed_routes:
        if not session.get("authenticated"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized. Please authenticate first."}), 401
            return redirect(url_for("auth.login"))

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

if __name__ == "__main__":
    # Pre-initialize client on boot if credentials exist
    try:
        run_in_background(get_or_create_client_async())
    except Exception:
        pass
        
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
