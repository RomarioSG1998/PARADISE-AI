from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
import json
import re
import os
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
    get_writer_document,
    get_writer_messages,
    add_writer_message,
    add_writer_context,
    get_writer_contexts,
    delete_writer_context,
    get_writer_material_details,
    create_writer_agent,
    get_writer_agents,
    delete_writer_agent,
    get_writer_agent,
    get_writer_agent_messages,
    add_writer_agent_message,
    reset_writer_agent_messages
)
from services.writer_service import generate_writer_chat_response_async, generate_agent_task_response_async
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
            
        material_id = add_writer_material(env_id, name, material_type, text_content)
        
        # Save original PDF binary if uploaded and created successfully
        if material_id and file and file.filename and filename.lower().endswith(".pdf"):
            try:
                uploads_dir = os.path.join(writer_bp.root_path, "..", "static", "uploads", "materials")
                os.makedirs(uploads_dir, exist_ok=True)
                pdf_path = os.path.join(uploads_dir, f"{material_id}.pdf")
                with open(pdf_path, "wb") as f:
                    f.write(file_bytes)
                print(f"[Paradise AI Debug] PDF file saved successfully to: '{pdf_path}'")
            except Exception as e:
                print(f"[Paradise AI Debug] Error saving PDF file: {e}")
                
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

@writer_bp.route("/api/writer/environments/<env_id>/messages", methods=["GET", "POST"])
def manage_messages(env_id):
    username = session.get("username")
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
        
    if request.method == "POST":
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
        ai_msg = parsed.get("message", ai_response)
        doc_update = parsed.get("document_update")
        selection_update = parsed.get("selection_update")
        
        # If there's an update, save it
        if doc_update is not None and active_doc_id:
            current_doc = get_writer_document(active_doc_id)
            title = current_doc.get("title", "Sem título") if current_doc else "Sem título"
            save_writer_document(env_id, active_doc_id, title, doc_update)
            
        # 3. Log AI message
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

@writer_bp.route("/api/writer/environments/<env_id>/contexts", methods=["GET", "POST"])
def manage_environment_contexts(env_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
        
    if request.method == "POST":
        name = ""
        content_text = ""
        
        # Check if form or JSON
        if request.is_json:
            data = request.get_json()
            name = data.get("name", "").strip()
            content_text = data.get("text_content", "").strip()
        else:
            name = request.form.get("name", "").strip()
            content_text = request.form.get("text_content", "").strip()
            
            file = request.files.get("file")
            if file and file.filename:
                if not name:
                    name = file.filename
                filename = file.filename
                if filename.lower().endswith(".pdf"):
                    try:
                        file_bytes = file.read()
                        reader = PdfReader(io.BytesIO(file_bytes))
                        extracted_text = ""
                        for page in reader.pages:
                            t = page.extract_text()
                            if t:
                                extracted_text += t + "\n"
                        content_text = extracted_text.strip()
                    except Exception as e:
                        return jsonify({"error": f"Falha ao extrair texto do PDF: {str(e)}"}), 400
                else:
                    try:
                        content_text = file.read().decode("utf-8", errors="ignore").strip()
                    except Exception as e:
                        return jsonify({"error": f"Falha ao ler arquivo: {str(e)}"}), 400
        
        if not name:
            name = "Contexto Sem Nome"
        if not content_text:
            return jsonify({"error": "Nome do contexto e arquivo/texto são obrigatórios!"}), 400
            
        add_writer_context(env_id, name, content_text)
        return jsonify({"success": True})
    else:
        contexts = get_writer_contexts(env_id)
        return jsonify(contexts)

@writer_bp.route("/api/writer/environments/<env_id>/contexts/<context_id>", methods=["DELETE"])
def delete_context_route(env_id, context_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
    delete_writer_context(context_id)
    return jsonify({"success": True})

@writer_bp.route("/api/writer/environments/<env_id>/materials/<material_id>/text", methods=["GET"])
def get_material_text_route(env_id, material_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
        
    snippet = request.args.get("snippet", "").strip()
    
    # Try direct lookup by material_id/slug
    details = get_writer_material_details(material_id)
    
    # If no snippet was passed (e.g. browser caching of the old JS file),
    # but the found material is a short placeholder, treat its content as the snippet!
    if details and not snippet and details.get("content_text") and len(details["content_text"]) < 300:
        snippet = details["content_text"].strip()
        
    # Scan all reference materials in the environment to find which one contains the snippet.
    # This acts as a robust recovery mechanism when citation IDs are misaligned or placeholder IDs are used.
    if snippet and len(snippet) > 8:
        from database import get_db_connection, get_cursor, DATABASE_URL, qry
        import re
        
        def normalize_text(t):
            if not t:
                return ""
            return re.sub(r"[^a-zA-Z0-9À-ÿ]", "", t.lower())
            
        norm_snippet = normalize_text(snippet)
        norm_snippet_part = norm_snippet[:40] if len(norm_snippet) > 40 else norm_snippet
        
        if len(norm_snippet_part) >= 8:
            conn = get_db_connection()
            cursor = get_cursor(conn)
            tbl = "public.writer_materials" if DATABASE_URL else "writer_materials"
            
            try:
                # Fetch only reference materials (ignore models and short placeholders)
                if DATABASE_URL:
                    cursor.execute(f"SELECT id, name, content_text FROM {tbl} WHERE environment_id = %s AND material_type = 'reference'", (env_id,))
                else:
                    cursor.execute(qry(f"SELECT id, name, content_text FROM {tbl} WHERE environment_id = ? AND material_type = 'reference'"), (env_id,))
                rows = cursor.fetchall()
            except Exception as e:
                print(f"[Paradise AI Debug] Fetch materials error: {e}")
                rows = []
                if DATABASE_URL:
                    conn.rollback()
            conn.close()
            
            matched_row = None
            for r in rows:
                row_text_norm = normalize_text(r["content_text"])
                if norm_snippet_part in row_text_norm:
                    # Prefer the material with the longest text (the original book/source)
                    if not matched_row or len(r["content_text"]) > len(matched_row["content_text"]):
                        matched_row = r
            
            if matched_row:
                details = dict(matched_row)

    if not details:
        return jsonify({"error": "Material not found"}), 404
        
    actual_id = details.get("id") or material_id
    # Check if PDF file exists on the server to render directly
    uploads_dir = os.path.join(writer_bp.root_path, "..", "static", "uploads", "materials")
    pdf_path = os.path.join(uploads_dir, f"{actual_id}.pdf")
    has_pdf = os.path.exists(pdf_path)
    
    return jsonify({
        "success": True,
        "name": details["name"],
        "content_text": details["content_text"],
        "has_pdf": has_pdf,
        "pdf_url": f"/static/uploads/materials/{actual_id}.pdf" if has_pdf else None
    })

# ─── AGENTS ROUTES ───────────────────────────────────────────────────────────

@writer_bp.route("/api/writer/environments/<env_id>/agents", methods=["GET", "POST"])
def manage_agents(env_id):
    username = session.get("username")
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == "POST":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        role = data.get("role", "sub-agente").strip()
        system_prompt = data.get("system_prompt", "").strip()
        is_leader = bool(data.get("is_leader", False))

        if not name:
            return jsonify({"error": "Nome do agente é obrigatório"}), 400

        agent_id = create_writer_agent(env_id, name, role, system_prompt, is_leader)
        return jsonify({"success": True, "id": agent_id})
    else:
        agents = get_writer_agents(env_id)
        # Serialize datetime for JSON
        for a in agents:
            if a.get("created_at"):
                a["created_at"] = str(a["created_at"])
        return jsonify(agents)


@writer_bp.route("/api/writer/environments/<env_id>/agents/<agent_id>", methods=["DELETE"])
def delete_agent_route(env_id, agent_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
    agent = get_writer_agent(agent_id)
    if not agent:
        return jsonify({"error": "Agent not found"}), 404
    if agent.get("is_leader"):
        return jsonify({"error": "O Agente Líder não pode ser excluído."}), 403
    delete_writer_agent(agent_id)
    return jsonify({"success": True})


@writer_bp.route("/api/writer/environments/<env_id>/agents/<agent_id>/reset", methods=["POST"])
def reset_agent_route(env_id, agent_id):
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
    reset_writer_agent_messages(agent_id)
    return jsonify({"success": True})


@writer_bp.route("/api/writer/environments/<env_id>/agents/<agent_id>/messages", methods=["GET", "POST"])
def manage_agent_messages(env_id, agent_id):
    username = session.get("username")
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == "POST":
        import threading
        data = request.get_json() or {}
        task = data.get("message", "").strip()
        if not task:
            return jsonify({"error": "Tarefa é obrigatória"}), 400

        # Log task immediately so UI shows it without waiting
        add_writer_agent_message(agent_id, "user", task)

        # Run agent in a background thread — non-blocking
        def run_task():
            ai_response, err = run_in_background(
                generate_agent_task_response_async(agent_id, env_id, task, username)
            )
            if err:
                report = f"⚠️ Erro na execução: {err}"
            else:
                report = (ai_response or "Tarefa concluída.").strip()
            add_writer_agent_message(agent_id, "ai", report)

        thread = threading.Thread(target=run_task, daemon=True)
        thread.start()

        return jsonify({"success": True, "status": "running"})

    else:
        msgs = get_writer_agent_messages(agent_id)
        for m in msgs:
            if m.get("created_at"):
                m["created_at"] = str(m["created_at"])
        return jsonify(msgs)


@writer_bp.route("/api/writer/environments/<env_id>/agents/<agent_id>/last", methods=["GET"])
def get_agent_last_message(env_id, agent_id):
    """Returns the last AI message — used for polling after task submission."""
    if not session.get("username"):
        return jsonify({"error": "Unauthorized"}), 401
    since = request.args.get("since")  # ISO timestamp or message count
    msgs = get_writer_agent_messages(agent_id)
    ai_msgs = [m for m in msgs if m.get("sender") == "ai"]
    if not ai_msgs:
        return jsonify({"done": False})
    last = ai_msgs[-1]
    if last.get("created_at"):
        last["created_at"] = str(last["created_at"])
    return jsonify({"done": True, "message": last})
