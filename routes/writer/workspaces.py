import os
import io
import re
from flask import request, jsonify, session
from pypdf import PdfReader
from .core import writer_bp
from services.writer.pdf_extractor import extract_text_from_pdf
from database import (
    create_writer_environment,
    get_writer_environments,
    delete_writer_environment,
    add_writer_material,
    get_writer_materials,
    delete_writer_material,
    add_writer_context,
    get_writer_contexts,
    delete_writer_context,
    get_writer_material_details
)

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
                    text_content = extract_text_from_pdf(file_bytes)
                    print(f"[Paradise AI Debug] manage_materials - PDF extracted text length: {len(text_content)}")
                except RuntimeError as e:
                    print(f"[Paradise AI Debug] PDF Extraction error: {e}")
                    return jsonify({"error": str(e)}), 400
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
    
    # If no snippet was passed, but the found material is a short placeholder, treat its content as the snippet
    if details and not snippet and details.get("content_text") and len(details["content_text"]) < 300:
        snippet = details["content_text"].strip()
        
    # Scan all reference materials in the environment to find which one contains the snippet
    if snippet and len(snippet) > 8:
        from database import get_db_connection, get_cursor, DATABASE_URL, qry
        
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
                    if not matched_row or len(r["content_text"]) > len(matched_row["content_text"]):
                        matched_row = r
            
            if matched_row:
                details = dict(matched_row)

    if not details:
        return jsonify({"error": "Trecho da citação ou material não encontrado nos arquivos de referência enviados."}), 404
        
    actual_id = details.get("id") or material_id
    # Check if PDF file exists on the server to render directly
    uploads_dir = os.path.join(writer_bp.root_path, "..", "static", "uploads", "materials")
    pdf_path = os.path.join(uploads_dir, f"{actual_id}.pdf")
    has_pdf = os.path.exists(pdf_path)
    
    exact_page = None
    if has_pdf and snippet:
        try:
            reader = PdfReader(pdf_path)
            
            def clean_text(text):
                if not text:
                    return ""
                return re.sub(r"\s+", " ", text.lower().replace("\n", " ").strip())
            
            clean_snippet = clean_text(snippet)
            words = [w for w in clean_snippet.split() if len(w) > 2]
            search_phrase = " ".join(words[:5]) if len(words) >= 5 else clean_snippet
            
            for idx, pdf_page in enumerate(reader.pages):
                try:
                    page_text = clean_text(pdf_page.extract_text())
                    if clean_snippet in page_text:
                        exact_page = idx + 1
                        break
                except Exception:
                    pass
            
            if not exact_page and search_phrase:
                for idx, pdf_page in enumerate(reader.pages):
                    try:
                        page_text = clean_text(pdf_page.extract_text())
                        if search_phrase in page_text:
                            exact_page = idx + 1
                            break
                    except Exception:
                        pass
                        
            if not exact_page and len(words) >= 3:
                short_phrase = " ".join(words[:3])
                for idx, pdf_page in enumerate(reader.pages):
                    try:
                        page_text = clean_text(pdf_page.extract_text())
                        if short_phrase in page_text:
                            exact_page = idx + 1
                            break
                    except Exception:
                        pass
        except Exception as e:
            print(f"[Paradise AI Debug] PDF search error: {e}")
            
    return jsonify({
        "success": True,
        "name": details["name"],
        "content_text": details["content_text"],
        "has_pdf": has_pdf,
        "pdf_url": f"/static/uploads/materials/{actual_id}.pdf" if has_pdf else None,
        "pdf_page": exact_page
    })
