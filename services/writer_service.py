import os
from services.ai_service import generate_text_unified_async
from database import (
    get_writer_materials_with_text,
    get_writer_documents,
    get_writer_document,
    get_writer_messages
)

async def generate_writer_chat_response_async(env_id, user_message, username, active_doc_id=None, selected_text=None):
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

    # 2. Fetch current active document content
    active_doc = None
    if active_doc_id:
        active_doc = get_writer_document(active_doc_id)
        
    if not active_doc:
        docs = get_writer_documents(env_id)
        if docs:
            active_doc = docs[0]
            
    doc_context = ""
    if active_doc:
        doc_context = f"Título: {active_doc['title']}\nConteúdo atual:\n{active_doc['content']}"
    else:
        doc_context = "(Nenhum texto foi escrito no editor ainda)"

    # 3. Fetch past messages for conversation history (last 10 to keep context responsive)
    past_msgs = get_writer_messages(env_id)
    chat_history = ""
    for m in past_msgs[-10:]:
        role_label = "Usuário" if m["sender"] == "user" else "AI"
        chat_history += f"{role_label}: {m['message']}\n"

    # 4. Build Prompt
    if selected_text:
        system_prompt = (
            "Você é o assistente de escrita do **writer.AI**. O usuário selecionou um trecho específico do documento para alteração.\n"
            "Seu papel é reescrever ou modificar APENAS o trecho selecionado com base na instrução fornecida.\n\n"
            "### TRECHO SELECIONADO PELO USUÁRIO:\n"
            f"\"{selected_text}\"\n\n"
            "### FORMATO DE RESPOSTA OBRIGATÓRIO (JSON):\n"
            "Você deve responder com um objeto JSON válido (sem qualquer texto fora do JSON, sem prefixo ou sufixo) no formato:\n"
            "{\n"
            '  "message": "Mensagem curta para o chat explicando o que foi feito.",\n'
            '  "document_update": null,\n'
            '  "selection_update": "Apenas o trecho reescrito correspondente ao trecho selecionado, aplicando as instruções do usuário (com tags HTML básicas se aplicável)"\n'
            "}\n\n"
            "### DIRETRIZES CRÍTICAS:\n"
            "1. Retorne APENAS o trecho reescrito/alterado correspondente à seleção em 'selection_update', aplicando a instrução dada.\n"
            "2. Não reescreva o documento inteiro, reescreva APENAS o trecho selecionado.\n"
            "3. Mantenha 'document_update' como null.\n"
            "4. Vá direto ao ponto."
        )
    else:
        system_prompt = (
            "Você é o assistente de escrita do **writer.AI**. Seu papel é ajudar o usuário a redigir, "
            "corrigir, estruturar, apagar e refinar o texto do documento atual.\n\n"
            "### FORMATO DE RESPOSTA OBRIGATÓRIO (JSON):\n"
            "Você deve responder com um objeto JSON válido (sem qualquer texto fora do JSON, sem prefixo ou sufixo) no formato:\n"
            "{\n"
            '  "message": "Mensagem curta para o chat explicando o que foi feito ou respondendo à dúvida.",\n'
            '  "document_update": "Código HTML completo do documento atualizado com as alterações aplicadas (ou null se nenhuma alteração global for solicitada/necessária)",\n'
            '  "selection_update": null\n'
            "}\n\n"
            "### DIRETRIZES CRÍTICAS:\n"
            "1. Se o usuário pedir para reescrever, corrigir, apagar ou adicionar texto, altere o documento todo e retorne o HTML completo em 'document_update'.\n"
            "2. Se o usuário estiver apenas conversando, retorne 'document_update' como null.\n"
            "3. Mantenha as tags HTML básicas (<p>, <h1>, <h2>, <strong>, <em>, <ul>, <li>) no seu 'document_update' para não perder a formatação.\n"
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
