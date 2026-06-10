import os
from services.ai_service import generate_text_unified_async
from database import (
    get_writer_materials_with_text,
    get_writer_documents,
    get_writer_document,
    get_writer_messages,
    get_writer_contexts
)

async def generate_writer_chat_response_async(env_id, user_message, username, active_doc_id=None, selected_text=None):
    # Fetch environments details for production contexts
    contexts = get_writer_contexts(env_id)
    production_context = ""
    for ctx in contexts:
        ctx_text = ctx.get("content_text")
        if ctx_text:
            production_context += f"--- CONTEXTO: {ctx['name']} ---\n{ctx_text.strip()}\n\n"
    production_context = production_context.strip()

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
            models_context += f"--- MODELO/TEMPLATE: {mat['name']} (ID: {mat['id']}) ---\n{truncated_text}\n\n"
        else:
            references_context += f"--- BASE TEÓRICA: {mat['name']} (ID: {mat['id']}) ---\n{truncated_text}\n\n"
    # 2. Fetch all documents in the environment to enable cross-document context awareness
    all_docs = get_writer_documents(env_id)
    active_doc = None
    if active_doc_id:
        active_doc = next((d for d in all_docs if str(d['id']) == str(active_doc_id)), None)
        
    if not active_doc and all_docs:
        active_doc = all_docs[0]
            
    doc_context = ""
    if active_doc:
        doc_context = f"Título: {active_doc['title']}\nConteúdo atual:\n{active_doc['content']}"
    else:
        doc_context = "(Nenhum texto foi escrito no editor ainda)"

    other_docs_context = ""
    for doc in all_docs:
        if active_doc and str(doc['id']) == str(active_doc['id']):
            continue
        content_snippet = (doc['content'] or '')[:15000]
        other_docs_context += f"--- DOCUMENTO ANTERIOR/APOIO: '{doc['title']}' ---\n{content_snippet}\n\n"

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
            "4. Vá direto ao ponto.\n"
            "5. REQUISITO DE CITAÇÃO (ABNT): O texto citado deve aparecer por extenso no corpo do documento. Insira imediatamente após o texto citado a tag contendo APENAS a indicação bibliográfica ABNT: `<span class=\"writer-citation\" data-material-id=\"ID_DO_MATERIAL\" data-snippet=\"trecho exato citado de 10-50 palavras consecutivas\" data-page=\"X\">(SOBRENOME, Ano, p. X)</span>`. A tag deve conter unicamente os parênteses da citação bibliográfica, funcionando apenas como link de verificação para o usuário."
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
            "1. EDITE O DOCUMENTO APENAS SE SOLICITADO: Retorne o campo 'document_update' como null a menos que o usuário EXPLICITAMENTE peça para você escrever, reescrever, alterar, formatar ou inserir algo no texto do editor (a 'folha'). Se ele pedir para modificar o documento, retorne o HTML atualizado do documento COMPLETO no campo 'document_update'.\n"
            "2. CONVERSA PADRÃO: Se o usuário estiver apenas fazendo uma pergunta, conversando normalmente, pedindo ideias, ou pedindo feedback/crítica sobre o texto (sem pedir para você alterar o texto), você DEVE retornar 'document_update' como null. Sua resposta deve ir apenas no campo 'message'.\n"
            "3. Mantenha as tags HTML básicas (<p>, <h1>, <h2>, <strong>, <em>, <ul>, <li>) no seu 'document_update' para não perder a formatação.\n"
            "4. REQUISITO DE CITAÇÃO ACADÊMICA (ABNT): O texto citado (direta ou indiretamente) DEVE ser escrito por extenso no corpo do documento (ou da resposta no chat). Imediatamente após esse texto, você deve adicionar a indicação bibliográfica de citação formatada de acordo com as normas ABNT (ex: (SOBRENOME, Ano, p. X) ou (SOBRENOME, Ano)) envolta na seguinte tag HTML de verificação:\n"
            "   `<span class=\"writer-citation\" data-material-id=\"ID_DO_MATERIAL\" data-snippet=\"trecho exato de 10-50 palavras consecutivas do texto original da referência\" data-page=\"X\">(SOBRENOME, Ano, p. X)</span>`\n"
            "   NÃO envolva a frase ou o parágrafo inteiro na tag `writer-citation`. A tag deve envolver unicamente a indicação entre parênteses. Ela servirá como link clicável para o usuário validar a fonte original no arquivo base. Insira o ID correto do material e a página estimada (se disponível)."
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

    if production_context:
        system_prompt += (
            "### CONTEXTO DE PRODUÇÃO (Orientações obrigatórias sobre o projeto, público-alvo ou tema):\n"
            f"{production_context}\n\n"
        )

    if other_docs_context:
        system_prompt += (
            "### OUTROS TEXTOS/DOCUMENTOS NESTE AMBIENTE (Use para manter a consistência e continuidade de escrita do projeto):\n"
            f"{other_docs_context.strip()}\n\n"
        )

    missing_elements = []
    if not models_context:
        missing_elements.append("- Modelos/Templates de texto (tom de voz, formato, estilo)")
    if not references_context:
        missing_elements.append("- Base Teórica/Referências (conteúdo a consultar ou citar)")
    if not production_context:
        missing_elements.append("- Contexto de Produção (detalhes sobre o projeto, público-alvo ou tema)")

    if missing_elements:
        system_prompt += (
            "### AVISOS DE MATERIAIS AUSENTES (OBRIGATÓRIO ALERTAR SE SOLICITADO):\n"
            "Os seguintes elementos de apoio NÃO foram fornecidos pelo usuário neste ambiente:\n"
            + "\n".join(missing_elements) + "\n\n"
            "Se o usuário solicitar ações que necessitem de algum desses materiais ausentes, "
            "você DEVE responder no campo 'message' alertando-o de forma clara. Siga estritamente as regras abaixo para cada caso:\n"
        )
        if not models_context:
            system_prompt += "- Se o usuário solicitar seguir o estilo ou template de modelos, você deve alertar: 'Você não forneceu nenhum arquivo de modelo/template de texto para eu seguir o estilo.'\n"
        if not references_context:
            system_prompt += "- Se o usuário solicitar consultar a base teórica ou referências, você deve alertar: 'Você não forneceu nenhum arquivo de base teórica/referência para eu consultar.'\n"
        if not production_context:
            system_prompt += "- Se o usuário solicitar adequar ao contexto de produção do projeto, você deve alertar: 'Você não forneceu nenhuma descrição ou arquivo de contexto de produção para eu saber os detalhes do projeto.'\n"
        system_prompt += "\n"

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


async def generate_agent_task_response_async(agent_id, env_id, task, username):
    """
    Agents are background task executors, not conversationalists.
    They receive a task, execute it using their specialized context,
    and respond ONLY with a brief completion report (max 3 sentences).
    """
    from database import (
        get_writer_agent,
        get_writer_materials_with_text,
        get_writer_contexts,
        get_writer_documents,
    )

    agent = get_writer_agent(agent_id)
    if not agent:
        return None, "Agent not found"

    agent_name    = agent.get("name", "Agente")
    agent_role    = agent.get("role", "sub-agente")
    agent_prompt  = (agent.get("system_prompt") or "").strip()
    is_leader     = agent.get("is_leader", False)

    # Build environment context (abbreviated — agents work fast)
    materials = get_writer_materials_with_text(env_id)
    references_ctx = ""
    for mat in materials:
        if mat["material_type"] == "reference" and mat.get("content_text"):
            references_ctx += f"[{mat['name']}]\n{mat['content_text'][:6000]}\n\n"

    contexts = get_writer_contexts(env_id)
    production_ctx = "".join(
        f"[{c['name']}]\n{c['content_text'].strip()}\n\n"
        for c in contexts if c.get("content_text")
    )

    all_docs = get_writer_documents(env_id)
    docs_ctx = "".join(
        f"[{d['title']}]\n{(d.get('content') or '')[:3000]}\n\n"
        for d in all_docs
    )

    if is_leader:
        identity = (
            f"Você é o AGENTE LÍDER '{agent_name}' deste ambiente de escrita acadêmica. "
            "Você coordena e delega tarefas com visão geral do projeto."
        )
    else:
        identity = (
            f"Você é o sub-agente '{agent_name}' ({agent_role}) deste ambiente de escrita. "
            "Você é um executor especializado subordinado ao Agente Líder."
        )

    system_prompt = (
        f"{identity}\n\n"
    )
    if agent_prompt:
        system_prompt += f"### SUA ESPECIALIZAÇÃO:\n{agent_prompt}\n\n"
    if references_ctx:
        system_prompt += f"### BASE TEÓRICA:\n{references_ctx}\n"
    if production_ctx:
        system_prompt += f"### CONTEXTO DO PROJETO:\n{production_ctx}\n"
    if docs_ctx:
        system_prompt += f"### DOCUMENTOS ATUAIS:\n{docs_ctx}\n"

    system_prompt += (
        "### REGRA CRÍTICA DE RESPOSTA:\n"
        "Você é um agente executor de tarefas em segundo plano.\n"
        "1. Execute internamente a tarefa recebida usando todo o contexto disponível.\n"
        "2. Responda APENAS com um relatório de conclusão CURTO: máximo 2-3 frases.\n"
        "3. Informe O QUE foi feito e o resultado principal, de forma direta e objetiva.\n"
        "4. NÃO escreva respostas longas, explicações detalhadas, nem reformule a tarefa.\n"
        "5. Tom: profissional, conciso. Exemplo: 'Tarefa concluída. [resultado em 1-2 frases].'\n\n"
        f"### TAREFA RECEBIDA:\n{task}"
    )

    response_text, err = await generate_text_unified_async(system_prompt, username=username)
    if err:
        return None, err

    # Hard-trim: if the AI still returned something long, keep only first 3 sentences
    if response_text:
        import re
        sentences = re.split(r'(?<=[.!?])\s+', response_text.strip())
        if len(sentences) > 4:
            response_text = " ".join(sentences[:4])

    return response_text, None
    return response_text, None
