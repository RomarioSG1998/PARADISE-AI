import json
import re
from flask import request, jsonify, session
from .core import writer_bp
from database import (
    add_writer_message,
    get_writer_messages,
    clear_writer_messages,
    get_writer_document,
    save_writer_document
)
from services.writer import generate_writer_chat_response_async
from utils.async_loop import run_in_background

def parse_ai_json_response(text):
    if not text:
        return {"message": "", "document_update": None}
    text = text.strip()
    
    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass

    # Try finding the first '{' and last '}' (most robust JSON extractor)
    start_idx = text.find('{')
    end_idx = text.rfind('}')
    
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_candidate = text[start_idx:end_idx+1]
        try:
            return json.loads(json_candidate)
        except Exception:
            pass

    # Fallback to code block regex extraction
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        json_candidate = match.group(1).strip()
        try:
            return json.loads(json_candidate)
        except Exception:
            pass

    # Completely failed to parse as JSON, return text as message
    return {
        "message": text,
        "document_update": None
    }

@writer_bp.route("/api/writer/environments/<env_id>/messages", methods=["GET", "POST", "DELETE"])
def manage_messages(env_id):
    username = session.get("username")
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
        
    if request.method == "DELETE":
        clear_writer_messages(env_id)
        return jsonify({"success": True, "message": "Conversation history reset successfully."})
        
    elif request.method == "POST":
        data = request.get_json() or {}
        user_message = data.get("message", "").strip()
        active_doc_id = data.get("active_doc_id")
        selected_text = data.get("selected_text")
        
        if not user_message:
            return jsonify({"error": "Message content is required"}), 400
            
        # 1. Log user message
        add_writer_message(env_id, "user", user_message)
        
        # 2. Generate AI response in background thread
        ai_response, err = run_in_background(generate_writer_chat_response_async(env_id, user_message, username, active_doc_id, selected_text))
        if err:
            ai_response_str = f"Desculpe, ocorreu um erro ao chamar a inteligência artificial: {err}"
            add_writer_message(env_id, "ai", ai_response_str)
            return jsonify({
                "success": True,
                "message": ai_response_str,
                "document_update": None,
                "selection_update": None
            })
            
        # Parse JSON response
        parsed = parse_ai_json_response(ai_response)
        
        if isinstance(parsed, dict) and "proposal" in parsed:
            ai_msg = json.dumps(parsed)
        else:
            ai_msg = parsed.get("message", ai_response) if isinstance(parsed, dict) else ai_response
            
        doc_update = parsed.get("document_update") if isinstance(parsed, dict) else None
        selection_update = parsed.get("selection_update") if isinstance(parsed, dict) else None
        # If there's an update, save it
        if doc_update is not None and active_doc_id:
            current_doc = get_writer_document(active_doc_id)
            title = current_doc.get("title", "Sem título") if current_doc else "Sem título"
            save_writer_document(env_id, active_doc_id, title, doc_update)
            
        # 3. Log AI message (consolidated)
        add_writer_message(env_id, "ai", ai_msg)
        
        return jsonify({
            "success": True,
            "message": ai_msg,
            "document_update": doc_update,
            "selection_update": selection_update
        })
    else:
        msgs = get_writer_messages(env_id)
        return jsonify(msgs)
