import os
from services.ai_service import generate_text_unified_async
from database import (
    get_writer_materials,
    get_writer_material_text,
    get_writer_documents,
    get_writer_messages
)

async def generate_writer_chat_response_async(env_id, user_message, username):
    # 1. Fetch materials (models & references)
    materials = get_writer_materials(env_id)
    models_context = ""
    references_context = ""
    
    for mat in materials:
        mat_text = get_writer_material_text(mat["id"])
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
        "Você é o agente inteligente do **writer.AI**, um assistente de escrita de elite, "
        "altamente colaborativo, criativo e preciso. Seu papel é interagir dinamicamente com o usuário, "
        "ajudando-o a redigir, corrigir, estruturar e refinar seu texto no editor central.\n\n"
        "Você deve guiar suas sugestões e estilo de escrita com base nos materiais fornecidos a seguir.\n\n"
    )

    if models_context:
        system_prompt += (
            "### MODELOS DE TEXTO / TEMPLATES (Siga a estrutura, tom e formato destes modelos):\n"
            f"{models_context}\n"
        )
    else:
        system_prompt += "### MODELOS DE TEXTO:\nNenhum modelo foi fornecido. Oriente o usuário de acordo com as boas práticas gerais.\n\n"

    if references_context:
        system_prompt += (
            "### BASE TEÓRICA / MATERIAIS DE REFERÊNCIA (Consulte e cite este material se necessário):\n"
            f"{references_context}\n"
        )
    else:
        system_prompt += "### BASE TEÓRICA:\nNenhum material de referência teórica foi fornecido.\n\n"

    system_prompt += (
        "### DOCUMENTO ATUAL NO EDITOR (O texto no centro da tela):\n"
        f"{doc_context}\n\n"
        "### HISTÓRICO RECENTE DA CONVERSA:\n"
        f"{chat_history}\n"
        "### DIRETRIZES DE RESPOSTA:\n"
        "1. Responda diretamente à mensagem do usuário.\n"
        "2. Se ele solicitar alterações ou correções, forneça trechos revisados do texto prontos para serem copiados ou inseridos.\n"
        "3. Faça citações e referências aos materiais de apoio quando apropriado.\n"
        "4. Mantenha a resposta focada, construtiva e formatada em Markdown limpo.\n"
    )

    full_prompt = f"{system_prompt}\nUsuário: {user_message}\nAI:"

    response_text, err = await generate_text_unified_async(full_prompt, username=username)
    if err:
        return None, err
        
    return response_text, None
