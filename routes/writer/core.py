from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from services.ai_service import generate_text_unified_async
from utils.async_loop import run_in_background

writer_bp = Blueprint("writer", __name__)

@writer_bp.route("/writer")
def index_writer():
    if not session.get("authenticated"):
        return redirect(url_for("auth.login"))
    return render_template("writer.html")

@writer_bp.route("/api/writer/correct-speech", methods=["POST"])
def correct_speech():
    username = session.get("username")
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"corrected_text": ""})
        
    # Correct the speech transcription using Gemini
    prompt = (
        "Você é um assistente de entrada de voz especializado em corrigir transcrições de áudio imperfeitas.\n"
        "O usuário ditou uma frase para um assistente de escrita acadêmica/técnica, e o mecanismo de transcrição do navegador cometeu erros de fonemas, ortografia ou gramática.\n"
        "Sua tarefa é corrigir esses erros, ajustando a pontuação, ortografia, concordância e termos técnicos (como ABNT, LaTeX, etc.) para que soe natural e correto, preservando rigorosamente a intenção original do usuário.\n"
        "Retorne UNICAMENTE o texto corrigido final, sem introduções, explicações, aspas ou comentários.\n\n"
        f"Texto transcrito:\n\"{text}\""
    )
    
    corrected_text, err = run_in_background(generate_text_unified_async(prompt, username=username))
    if err or not corrected_text:
        return jsonify({"corrected_text": text})
        
    return jsonify({"corrected_text": corrected_text.strip().strip('"')})
