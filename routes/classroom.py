from flask import Blueprint, request, jsonify, render_template, session
from services.classroom_service import generate_classroom_async
from utils.async_loop import run_in_background

classroom_bp = Blueprint("classroom", __name__)

@classroom_bp.route("/classroom")
def index_classroom():
    return render_template("classroom.html")

@classroom_bp.route("/api/classroom/generate", methods=["POST"])
def generate_classroom():
    input_type = "theme"
    content = ""
    
    if request.is_json:
        data = request.get_json() or {}
        input_type = data.get("type", "theme")
        content = data.get("content", "").strip()
    else:
        input_type = request.form.get("type", "theme")
        if input_type == "pdf":
            if "file" not in request.files:
                return jsonify({"error": "Nenhum arquivo enviado"}), 400
            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "Nome do arquivo vazio"}), 400
                
            try:
                from pypdf import PdfReader
                reader = PdfReader(file.stream)
                extracted_text = []
                for page in reader.pages:
                    text_page = page.extract_text()
                    if text_page:
                        extracted_text.append(text_page)
                content = "\n".join(extracted_text)
                if not content.strip():
                    return jsonify({"error": "Não foi possível extrair texto do PDF"}), 400
            except Exception as e:
                return jsonify({"error": f"Erro ao processar PDF: {str(e)}"}), 500
        else:
            content = request.form.get("content", "").strip()
            
    if not content:
        return jsonify({"error": "Conteúdo ou tema não especificado"}), 400
        
    # Retrieve lang_code and style
    if request.is_json:
        data = request.get_json() or {}
        print("[Paradise Debug] JSON Request Data:", data)
        lang_code = data.get("language") or request.cookies.get("paradise_language", "pt")
        style = data.get("style", "classic")
        duration_min = data.get("duration", "3")
        output_format = data.get("output_format", data.get("format", "youtube")).strip()
    else:
        print("[Paradise Debug] Form Request Data:", request.form)
        lang_code = request.form.get("language") or request.cookies.get("paradise_language", "pt")
        style = request.form.get("style", "classic")
        duration_min = request.form.get("duration", "3")
        output_format = request.form.get("output_format", request.form.get("format", "youtube")).strip()

    print(f"[Paradise Debug] Extracted parameters - type: {input_type}, style: {style}, duration: {duration_min}, output_format: {output_format}")

    try:
        username = session.get("username")
        lesson_data = run_in_background(generate_classroom_async(content, lang_code, duration_min=duration_min, style=style, output_format=output_format, username=username))
        return jsonify(lesson_data)
    except Exception as e:
        print("[Paradise Debug] Error generating classroom:", e)
        return jsonify({"error": str(e)}), 500


@classroom_bp.route("/api/classroom/ask", methods=["POST"])
def ask_teacher():
    if not request.is_json:
        return jsonify({"error": "Requisição deve ser JSON"}), 400
        
    data = request.get_json() or {}
    subject = data.get("subject", "").strip()
    slide_title = data.get("slide_title", "").strip()
    slide_narration = data.get("slide_narration", "").strip()
    question = data.get("question", "").strip()
    lang_code = data.get("language") or request.cookies.get("paradise_language", "pt")
    style = data.get("style", "classic").strip()
    output_format = data.get("output_format", data.get("format", "youtube")).strip()
    
    if not question:
        return jsonify({"error": "A pergunta não pode ser vazia"}), 400
        
    try:
        from services.classroom_service import generate_classroom_explanation_async
        username = session.get("username")
        explanation = run_in_background(generate_classroom_explanation_async(subject, slide_title, slide_narration, question, lang_code, style=style, output_format=output_format, username=username))
        return jsonify(explanation)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
