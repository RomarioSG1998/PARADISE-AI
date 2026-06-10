import os
from services.ai_service import generate_text_unified_async
from database import (
    get_writer_materials_with_text,
    get_writer_documents,
    get_writer_messages
)

async def generate_writer_chat_response_async(env_id, user_message, username):
    # 1. Fetch materials (models & references) in a single optimized DB round-trip
    materials = get_writer_materials_with_text(env_id)
    models_context = ""
    references_context = ""
    
    for mat in materials:
        mat_text = mat.get("content_text")
        if not mat_text:
            continue
        # Limit context size to avoid overloading (approx 20k chars per doc)
        truncated_text = mat_text[:20000]
        if mat["material_type"] == "model":
            models_context += f"--- MODELO/TEMPLATE: {mat['name']} ---\n{truncated_text}\n\n"
        else:
            references_context += f"--- BASE TEÓRICA: {mat['name']} ---\n{truncated_text}\n\n"

    # 2. Fetch current document content
    docs = get_writer_documents(env_id)
    doc_context = ""
    if docs:
        doc_context = f"Título: {docs[0]['title']}\nConteúdo atual:\n{docs[0]['content']}"
    else:
        doc_context = "(Nenhum texto foi escrito no editor ainda)"

    # 3. Fetch past messages for conversation history (last 10 to keep context responsive)
    past_msgs = get_writer_messages(env_id)
    chat_history = ""
    for m in past_msgs[-10:]:
        role_label = "Usuário" if m["sender"] == "user" else "AI"
        chat_history += f"{role_label}: {m['message']}\n"

    # 4. Build Prompt
    system_prompt = (
        "Você é o assistente de escrita do **writer.AI**. Seu papel é ajudar o usuário a redigir, "
        "corrigir, estruturar e refinar seu texto de forma direta, objetiva e sem rodeios.\n\n"
        "### DIRETRIZES CRÍTICAS DE RESPOSTA:\n"
        "1. Dê respostas claras, curtas e 100% diretas ao ponto.\n"
        "2. NUNCA envie introduções, explicações prévias ou saudações formais repetitivas (ex: NÃO diga coisas como 'Com base nos materiais...' ou 'Aqui está a versão corrigida:'). Vá direto ao texto reescrito ou à resposta.\n"
        "3. Se o usuário pedir para reescrever ou corrigir um trecho, retorne APENAS o texto revisado em Markdown, sem explicações prolixas ao redor.\n"
        "4. Apenas consulte ou cite os modelos e materiais de apoio teóricos (fornecidos abaixo) caso o comando do usuário exija isso explicitamente (ex: se pedir para embasar cientificamente ou imitar a estrutura do modelo). Caso contrário, ignore-os e responda diretamente.\n\n"
    )

    if models_context:
        system_prompt += (
            "### MODELOS DE TEXTO / TEMPLATES (Use como base de estilo apenas se solicitado):\n"
            f"{models_context}\n"
        )

    if references_context:
        system_prompt += (
            "### BASE TEÓRICA / REFERÊNCIAS (Consulte e cite apenas se necessário):\n"
            f"{references_context}\n"
        )

    system_prompt += (
        "### DOCUMENTO ATUAL NO EDITOR:\n"
        f"{doc_context}\n\n"
        "### HISTÓRICO DA CONVERSA:\n"
        f"{chat_history}\n"
    )

    full_prompt = f"{system_prompt}\nUsuário: {user_message}\nAI:"

    response_text, err = await generate_text_unified_async(full_prompt, username=username)
    if err:
        return None, err
        
    return response_text, None
