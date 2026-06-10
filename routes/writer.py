from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
from database import (
    create_writer_environment,
    get_writer_environments,
    get_writer_environment,
    delete_writer_environment,
    add_writer_material,
    get_writer_materials,
    delete_writer_material,
    save_writer_document,
    get_writer_documents,
    delete_writer_document,
    get_writer_messages,
    add_writer_message
)
from services.writer_service import generate_writer_chat_response_async
from utils.async_loop import run_in_background
from pypdf import PdfReader
import io

writer_bp = Blueprint("writer", __name__)

@writer_bp.route("/writer")
def index_writer():
    if not session.get("authenticated"):
        return redirect(url_for("auth.login"))
    return render_template("writer.html")

@writer_bp.route("/api/writer/environments", methods=["GET", "POST"])
def manage_environments():
    username = session.get("username")
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
        
    if request.method == "POST":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        if not name:
            return jsonify({"error": "Environment name is required"}), 400
            
        env_id = create_writer_environment(username, name)
        return jsonify({"success": True, "id": env_id, "name": name})
    else:
        envs = get_writer_environments(username)
        return jsonify(envs)

@writer_bp.route("/api/writer/environments/<env_id>", methods=["DELETE"])
def delete_environment_route(env_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
    delete_writer_environment(env_id)
    return jsonify({"success": True})

@writer_bp.route("/api/writer/environments/<env_id>/materials", methods=["GET", "POST"])
def manage_materials(env_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
        
    if request.method == "POST":
        material_type = request.form.get("material_type", "reference").strip()
        name = request.form.get("name", "").strip()
        
        file = request.files.get("file")
        text_content = request.form.get("text_content", "").strip()
        
        print(f"[Paradise AI Debug] manage_materials - name received: '{name}'")
        print(f"[Paradise AI Debug] manage_materials - text_content length: {len(text_content)}")
        
        if file and file.filename:
            filename = file.filename
            print(f"[Paradise AI Debug] manage_materials - file name: '{filename}'")
            if not name:
                name = filename
                print(f"[Paradise AI Debug] manage_materials - fallback name to filename: '{name}'")
            if filename.lower().endswith(".pdf"):
                try:
                    file_bytes = file.read()
                    print(f"[Paradise AI Debug] manage_materials - read {len(file_bytes)} file bytes")
                    reader = PdfReader(io.BytesIO(file_bytes))
                    extracted_text = ""
                    for page in reader.pages:
                        t = page.extract_text()
                        if t:
                            extracted_text += t + "\n"
                    text_content = extracted_text.strip()
                    print(f"[Paradise AI Debug] manage_materials - PDF extracted text length: {len(text_content)}")
                except Exception as e:
                    print(f"[Paradise AI Debug] PDF Extraction error: {e}")
                    return jsonify({"error": f"Falha ao extrair texto do PDF: {str(e)}"}), 400
            else:
                try:
                    text_content = file.read().decode("utf-8", errors="ignore")
                    print(f"[Paradise AI Debug] manage_materials - TXT file read text length: {len(text_content)}")
                except Exception as e:
                    print(f"[Paradise AI Debug] TXT File Read error: {e}")
                    return jsonify({"error": f"Falha ao ler arquivo de texto: {str(e)}"}), 400
                    
        print(f"[Paradise AI Debug] Final validation check - name: '{name}', text_content length: {len(text_content)}")
        if not name or not text_content:
            return jsonify({"error": "Nome do material e arquivo/texto são obrigatórios!"}), 400
            
        add_writer_material(env_id, name, material_type, text_content)
        return jsonify({"success": True})
    else:
        materials = get_writer_materials(env_id)
        return jsonify(materials)

@writer_bp.route("/api/writer/environments/<env_id>/materials/<material_id>", methods=["DELETE"])
def delete_material_route(env_id, material_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
    delete_writer_material(material_id)
    return jsonify({"success": True})

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

@writer_bp.route("/api/writer/environments/<env_id>/messages", methods=["GET", "POST"])
def manage_messages(env_id):
    username = session.get("username")
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
        
    if request.method == "POST":
        data = request.get_json() or {}
        user_message = data.get("message", "").strip()
        if not user_message:
            return jsonify({"error": "Message content is required"}), 400
            
        # 1. Log user message
        add_writer_message(env_id, "user", user_message)
        
        # 2. Generate AI response in background thread
        ai_response, err = run_in_background(generate_writer_chat_response_async(env_id, user_message, username))
        if err:
            ai_response = f"Desculpe, ocorreu um erro ao chamar a inteligência artificial: {err}"
            
        # 3. Log AI message
        add_writer_message(env_id, "ai", ai_response)
        
        return jsonify({
            "success": True,
            "message": ai_response
        })
    else:
        msgs = get_writer_messages(env_id)
        return jsonify(msgs)
