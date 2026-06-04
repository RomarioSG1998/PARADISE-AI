from flask import Blueprint, request, jsonify, render_template
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
        
    # Retrieve lang_code
    if request.is_json:
        data = request.get_json() or {}
        lang_code = data.get("language") or request.cookies.get("paradise_language", "pt")
    else:
        lang_code = request.form.get("language") or request.cookies.get("paradise_language", "pt")

    try:
        lesson_data = run_in_background(generate_classroom_async(content, lang_code))
        return jsonify(lesson_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
