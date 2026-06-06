from flask import Blueprint, request, jsonify, render_template, session
from services.book_service import generate_book_async, illustrate_scene_async, explain_word_async
from utils.async_loop import run_in_background

book_bp = Blueprint("book", __name__)

@book_bp.route("/book")
def index_book():
    return render_template("book.html")

@book_bp.route("/api/book/generate", methods=["POST"])
def generate_book():
    data = request.get_json() or {}
    theme = data.get("theme", "").strip()
    level = data.get("level", "").strip()
    language = data.get("language", "").strip()
    visual_theme = data.get("visual_theme", "cartoon").strip()
    
    if not theme or not level or not language:
        return jsonify({"error": "Theme, level, and language are required"}), 400

    username = session.get("username")
    result, err = run_in_background(generate_book_async(theme, level, language, visual_theme, username=username))
    if err:
        return jsonify({"error": err}), 500
        
    return jsonify(result)

@book_bp.route("/api/book/illustrate-scene", methods=["POST"])
def illustrate_scene():
    data = request.get_json() or {}
    prompt = data.get("prompt", "").strip()
    visual_theme = data.get("visual_theme", "cartoon").strip()
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
        
    username = session.get("username")
    result, err = run_in_background(illustrate_scene_async(prompt, visual_theme, username=username))
    if err:
        return jsonify({"error": err}), 500
        
    return jsonify(result)

@book_bp.route("/api/book/explain-word", methods=["POST"])
def explain_word():
    data = request.get_json() or {}
    word = data.get("word", "").strip()
    sentence = data.get("sentence", "").strip()
    book_lang = data.get("book_language", "").strip()
    
    if not word or not sentence or not book_lang:
        return jsonify({"error": "Word, sentence, and book language are required"}), 400
        
    user_lang_code = data.get("language") or request.cookies.get("paradise_language", "pt")
    if user_lang_code not in ["pt", "en", "es"]:
        user_lang_code = "pt"
        
    book_lang_lower = book_lang.lower()
    is_book_english = "inglês" in book_lang_lower or "english" in book_lang_lower or book_lang_lower == "en"
    is_book_spanish = "espanhol" in book_lang_lower or "spanish" in book_lang_lower or "español" in book_lang_lower or book_lang_lower == "es"
    is_book_portuguese = "português" in book_lang_lower or "portuguese" in book_lang_lower or book_lang_lower == "pt"
    
    if user_lang_code == "en":
        target_lang = "Portuguese" if is_book_english else "English"
    elif user_lang_code == "es":
        target_lang = "Portugués" if is_book_spanish else "Español"
    else: # pt
        target_lang = "Inglês" if is_book_portuguese else "Português"
        
    username = session.get("username")
    result, err = run_in_background(explain_word_async(word, sentence, book_lang, target_lang, user_lang_code, username=username))
    if err:
        return jsonify({"error": err}), 500
        
    return jsonify(result)
