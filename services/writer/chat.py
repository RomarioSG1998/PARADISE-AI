import json
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
        msg_text = m["message"]
        if msg_text.strip().startswith("{") and msg_text.strip().endswith("}"):
            try:
                parsed = json.loads(msg_text)
                proposal_info = ""
                if parsed.get("proposal"):
                    prop = parsed["proposal"]
                    proposal_info = f"\n[CONTEÚDO PROPOSTO PARA ALTERAÇÃO no documento '{prop.get('document_title')}']:\n{prop.get('content')}"
                msg_text = f"(Relatório do Sub-agente: {parsed.get('report')}){proposal_info}"
            except Exception:
                pass
        chat_history += f"{role_label}: {msg_text}\n"

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
            "3. Mantenha 'document_update' as null.\n"
            "4. Vá direto ao ponto.\n"
            "5. REQUISITO DE CITAÇÃO ACADÊMICA OBRIGATÓRIA (ABNT):\n"
            "   Ao basear-se ou citar trechos das referências fornecidas (Base Teórica), você DEVE obrigatoriamente incluir a tag de citação. O texto citado deve aparecer por extenso no corpo do documento.\n"
            "   Insira imediatamente após o texto citado a tag contendo APENAS a indicação bibliográfica ABNT entre parênteses: "
            "`<span class=\"writer-citation\" data-material-id=\"ID_DO_MATERIAL\" data-snippet=\"trecho exato de 10-50 palavras consecutivas do texto original da referência\" data-page=\"X\">(SOBRENOME, Ano, p. X)</span>`.\n"
            "   REGRAS DE OURO PARA CITAÇÕES:\n"
            "   - `data-material-id`: Substitua pelo ID exato do material fornecido no título do material (ex: se o título for '--- BASE TEÓRICA: Guia (ID: 15) ---', o ID é '15').\n"
            "   - `data-snippet`: Cole um trecho de 10 a 50 palavras consecutivas COMPLETAMENTE IDÊNTICO (verbatim) ao texto original da referência (não traduza, não altere pontuação ou palavras, deve ser idêntico para que a busca encontre no arquivo base).\n"
            "   - `data-page`: Insira a página estimada ou real em que o trecho original está, ou 'n/a' se não souber.\n"
            "   - NÃO envolva a frase ou o parágrafo inteiro na tag `writer-citation`. A tag deve conter unicamente os parênteses da citação bibliográfica, servindo como link clicável de verificação.\n"
            "   - EXEMPLO:\n"
            "     Se o material tiver ID '42' e contiver a frase 'O método experimental consiste em submeter os objetos de estudo a variáveis...', e você usou isso, escreva no texto:\n"
            "     'O método experimental consiste em submeter os objetos de estudo a variáveis <span class=\"writer-citation\" data-material-id=\"42\" data-snippet=\"O método experimental consiste em submeter os objetos de estudo a variáveis\" data-page=\"15\">(SILVA, 2020, p. 15)</span>.'"
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
            "2. CONVERSA PADRÃO: Se o usuário estiver apenas fazendo uma pergunta, conversando normalmente, pedindo ideias, ou pedindo feedback/crítica sobre o texto (sem pedir para você alterar o texto), você DEVE retornar 'document_update' as null. Sua resposta deve ir apenas no campo 'message'.\n"
            "3. Mantenha as tags HTML básicas (<p>, <h1>, <h2>, <strong>, <em>, <ul>, <li>) no seu 'document_update' para não perder a formatação.\n"
            "4. REQUISITO DE CITAÇÃO ACADÊMICA OBRIGATÓRIA (ABNT):\n"
            "   Ao basear-se ou citar trechos das referências fornecidas (Base Teórica), você DEVE obrigatoriamente incluir a tag de citação. O texto citado deve aparecer por extenso no corpo do documento (ou da resposta no chat).\n"
            "   Insira imediatamente após o texto citado a tag contendo APENAS a indicação bibliográfica ABNT entre parênteses: "
            "`<span class=\"writer-citation\" data-material-id=\"ID_DO_MATERIAL\" data-snippet=\"trecho exato de 10-50 palavras consecutivas do texto original da referência\" data-page=\"X\">(SOBRENOME, Ano, p. X)</span>`.\n"
            "   REGRAS DE OURO PARA CITAÇÕES:\n"
            "   - `data-material-id`: Substitua pelo ID exato do material fornecido no título do material (ex: se o título for '--- BASE TEÓRICA: Guia (ID: 15) ---', o ID é '15').\n"
            "   - `data-snippet`: Cole um trecho de 10 a 50 palavras consecutivas COMPLETAMENTE IDÊNTICO (verbatim) ao texto original da referência (não traduza, não altere pontuação ou palavras, deve ser idêntico para que a busca encontre no arquivo base).\n"
            "   - `data-page`: Insira a página estimada ou real em que o trecho original está, ou 'n/a' se não souber.\n"
            "   - NÃO envolva a frase ou o parágrafo inteiro na tag `writer-citation`. A tag deve conter unicamente os parênteses da citação bibliográfica, servindo como link clicável de verificação.\n"
            "   - EXEMPLO:\n"
            "     Se o material tiver ID '42' e contiver a frase 'O método experimental consiste em submeter os objetos de estudo a variáveis...', e você usou isso, escreva no texto:\n"
            "     'O método experimental consiste em submeter os objetos de estudo a variáveis <span class=\"writer-citation\" data-material-id=\"42\" data-snippet=\"O método experimental consiste em submeter os objetos de estudo a variáveis\" data-page=\"15\">(SILVA, 2020, p. 15)</span>.'"
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
