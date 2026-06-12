import re
from flask import request, jsonify, session
from .core import writer_bp
from database import (
    save_writer_document,
    get_writer_documents,
    delete_writer_document
)
from services.ai_service import generate_text_unified_async
from utils.async_loop import run_in_background

@writer_bp.route("/api/writer/environments/<env_id>/documents", methods=["GET", "POST"])
def manage_documents(env_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
        
    if request.method == "POST":
        data = request.get_json() or {}
        doc_id = data.get("id")
        title = data.get("title", "").strip() or "Sem título"
        content = data.get("content", "").strip()
        
        saved_id = save_writer_document(env_id, doc_id, title, content)
        return jsonify({"success": True, "id": saved_id})
    else:
        docs = get_writer_documents(env_id)
        return jsonify(docs)

@writer_bp.route("/api/writer/environments/<env_id>/documents/<doc_id>", methods=["DELETE"])
def delete_document_route(env_id, doc_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
    delete_writer_document(doc_id)
    return jsonify({"success": True})

@writer_bp.route("/api/writer/environments/<env_id>/documents/<doc_id>/edit-selection", methods=["POST"])
def edit_document_selection(env_id, doc_id):
    username = session.get("username")
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.get_json() or {}
    selected_text = data.get("selected_text", "").strip()
    instruction = data.get("instruction", "").strip()
    full_content = data.get("full_content", "").strip()
    
    if not selected_text or not instruction:
        return jsonify({"error": "Selection and instruction are required"}), 400
        
    prompt = (
        "Você é um editor assistente de escrita de alto nível.\n"
        "O usuário deseja alterar um trecho específico de um documento.\n\n"
        "### CONTEXTO DO DOCUMENTO COMPLETO:\n"
        f"{full_content}\n\n"
        "### TRECHO SELECIONADO QUE DEVE SER ALTERADO:\n"
        f"{selected_text}\n\n"
        "### INSTRUÇÃO DE ALTERAÇÃO DO USUÁRIO:\n"
        f"{instruction}\n\n"
        "### DIRETRIZES DE RETORNO:\n"
        "1. Retorne APENAS o trecho reescrito/alterado correspondente à seleção, aplicando a instrução dada.\n"
        "2. NÃO inclua explicações, comentários, introduções, aspas extras ou qualquer outro texto ao redor. Retorne estritamente o trecho substituto final (com tags HTML básicas de formatação se o trecho original tinha formatação, ou apenas texto simples).\n"
        "3. Vá direto ao texto reescrito."
    )
    
    updated_text, err = run_in_background(generate_text_unified_async(prompt, username=username))
    if err:
        return jsonify({"error": str(err)}), 500
        
    cleaned_text = updated_text.strip()
    if cleaned_text.startswith("```"):
        match = re.match(r"^```(?:html|text|markdown)?\s*([\s\S]*?)\s*```$", cleaned_text)
        if match:
            cleaned_text = match.group(1).strip()
            
    if (cleaned_text.startswith('"') and cleaned_text.endswith('"')) or (cleaned_text.startswith("'") and cleaned_text.endswith("'")):
        cleaned_text = cleaned_text[1:-1].strip()
        
    return jsonify({
        "success": True,
        "updated_text": cleaned_text
    })
