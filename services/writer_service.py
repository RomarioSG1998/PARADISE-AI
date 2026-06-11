import os
from services.ai_service import generate_text_unified_async
from database import (
    get_writer_materials_with_text,
    get_writer_documents,
    get_writer_document,
    get_writer_messages,
    get_writer_contexts,
    get_writer_agents
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

    # Fetch agents details
    agents = get_writer_agents(env_id)
    agents_list_str = ""
    for a in agents:
        agents_list_str += f"- {a['name']} (Função/Especialidade: {a['role'] or 'sub-agente'}, ID: {a['id']})\n"

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
    import json
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
            '  "selection_update": null,\n'
            '  "delegate_agent_task": null, // Ou {"agent_id_or_name": "NOME_OU_ID_DO_AGENTE", "task": "Instrução de tarefa..."}\n'
            '  "create_subagent": null // Ou {"name": "Nome do Agente", "role": "Especialidade", "system_prompt": "Instruções do sistema para o agente", "delegate_task": "Tarefa opcional para iniciar rodando"}\n'
            "}\n\n"
            "### DIRETRIZES CRÍTICAS:\n"
            "1. EDITE O DOCUMENTO APENAS SE SOLICITADO: Retorne o campo 'document_update' como null a menos que o usuário EXPLICITAMENTE peça para você escrever, reescrever, alterar, formatar ou inserir algo no texto do editor (a 'folha'). Se ele pedir para modificar o documento, retorne o HTML atualizado do documento COMPLETO no campo 'document_update'.\n"
            "2. CONVERSA PADRÃO: Se o usuário estiver apenas fazendo uma pergunta, conversando normalmente, pedindo ideias, ou pedindo feedback/crítica sobre o texto (sem pedir para você alterar o texto), você DEVE retornar 'document_update' as null. Sua resposta deve ir apenas no campo 'message'.\n"
            "3. Mantenha as tags HTML básicas (<p>, <h1>, <h2>, <strong>, <em>, <ul>, <li>) no seu 'document_update' para não perder a formatação.\n"
            "4. REQUISITO DE CITAÇÃO ACADÊMICA (ABNT): O texto citado (direta ou indiretamente) DEVE ser escrito por extenso no corpo do documento (ou da resposta no chat). Imediatamente após esse texto, você deve adicionar a indicação bibliográfica de citação formatada de acordo com as normas ABNT (ex: (SOBRENOME, Ano, p. X) ou (SOBRENOME, Ano)) envolta na seguinte tag HTML de verificação:\n"
            "   `<span class=\"writer-citation\" data-material-id=\"ID_DO_MATERIAL\" data-snippet=\"trecho exato de 10-50 palavras consecutivas do texto original da referência\" data-page=\"X\">(SOBRENOME, Ano, p. X)</span>`\n"
            "   NÃO envolva a frase ou o parágrafo inteiro na tag `writer-citation`. A tag deve envolver unicamente a indicação entre parênteses. Ela servirá como link clicável para o usuário validar a fonte original no arquivo base. Insira o ID correto do material e a página estimada (se disponível).\n"
            "5. AUTONOMIA PARA CRIAR SUB-AGENTES: Se o usuário pedir para você criar, instanciar ou sugerir um novo especialista, assistente, robô ou sub-agente especializado (ex: 'Crie um sub-agente revisor ABNT'), você DEVE preencher o campo 'create_subagent' com os dados sugeridos de nome, especialidade/role, instruções de sistema detalhadas, e uma tarefa opcional em 'delegate_task' se ele pediu para começar a rodar uma tarefa imediatamente.\n"
            "6. APLICAÇÃO DE PROPOSTAS DE SUB-AGENTES (CRÍTICO): Se o usuário solicitar a aplicação das alterações propostas por um sub-agente (ex: 'Sim, pode aplicar a alteração', 'aplique as mudanças', 'pode atualizar o documento', 'aplicar'), você DEVE extrair o conteúdo proposto (que está logo acima no histórico de chat) e retorná-lo na íntegra no campo 'document_update' da sua resposta JSON. Isso permitirá ao usuário revisar e manter as alterações no editor.\n"
        )
        if agents_list_str:
            system_prompt += (
                "7. DELEGAÇÃO DE TAREFA EM SEGUNDO PLANO: Se o usuário solicitar alguma tarefa especializada que encaixe no perfil dos sub-agentes abaixo, você deve delegar a tarefa preenchendo o campo 'delegate_agent_task' da sua resposta JSON. O sub-agente trabalhará em segundo plano sem que o usuário precise abrir a janela dele. O relatório final será exibido no canal do sub-agente.\n"
                "### SUB-AGENTES DISPONÍVEIS NESTE AMBIENTE:\n"
                f"{agents_list_str}\n"
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


def parse_agent_json(text):
    if not text:
        return None
    text = text.strip()
    
    # Clean up unescaped double quotes inside string values of common keys
    import re
    cleaned_text = text
    for key in ["thought", "report", "text", "content", "query", "title", "system_prompt", "task", "document_id_or_title"]:
        pattern = re.compile(r"(\"" + key + r"\"\s*:\s*\")(.*?)(\"\s*(?:,|\n|\}))", re.DOTALL)
        def replace_quotes(match):
            prefix = match.group(1)
            content = match.group(2)
            suffix = match.group(3)
            # Unescape already escaped double quotes to avoid double-escaping
            content_cleaned = content.replace('\\"', '"')
            # Escape all double quotes in content
            content_escaped = content_cleaned.replace('"', '\\"')
            return prefix + content_escaped + suffix
        cleaned_text = pattern.sub(replace_quotes, cleaned_text)

    # Try finding the first '{' and last '}' (most robust JSON extractor) using the cleaned text
    start_idx = cleaned_text.find('{')
    end_idx = cleaned_text.rfind('}')
    
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_candidate = cleaned_text[start_idx:end_idx+1]
        try:
            import json
            return json.loads(json_candidate)
        except Exception:
            pass
            
    try:
        import json
        return json.loads(cleaned_text)
    except Exception:
        pass
        
    # Fallback to code block regex extraction using cleaned text
    import re as regex
    match = regex.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned_text)
    if match:
        json_candidate = match.group(1).strip()
        try:
            import json
            return json.loads(json_candidate)
        except Exception:
            pass
            
    # Final fallback: Try original text in case cleaning failed
    start_idx = text.find('{')
    end_idx = text.rfind('}')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_candidate = text[start_idx:end_idx+1]
        try:
            import json
            return json.loads(json_candidate)
        except Exception:
            pass
            
    return None


async def generate_agent_task_response_async(agent_id, env_id, task, username, depth=0):
    """
    Subagents in writer.AI are background task executors that can read/write files,
    search references, and delegate tasks to other subagents in a ReAct loop.
    """
    from database import (
        get_writer_agent,
        get_writer_materials_with_text,
        get_writer_contexts,
        get_writer_documents,
        save_writer_document,
        get_writer_agents,
        add_writer_agent_message,
    )
    import json
    import re

    pending_proposal = None

    agent = get_writer_agent(agent_id)
    if not agent:
        return None, "Agent not found"

    agent_name    = agent.get("name", "Agente")
    agent_role    = agent.get("role", "sub-agente")
    agent_prompt  = (agent.get("system_prompt") or "").strip()
    is_leader     = agent.get("is_leader", False)

    if depth > 3:
        return "Erro: Limite de profundidade de delegação excedido (potencial loop circular).", None

    # Retrieve all items in the environment for reference matching
    materials = get_writer_materials_with_text(env_id)
    contexts = get_writer_contexts(env_id)
    all_docs = get_writer_documents(env_id)
    all_agents = get_writer_agents(env_id)

    # 1. Initial Prompt with Tool Instructions
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
        "Você é um agente autônomo e inteligente de escrita. Você trabalha em segundo plano. "
        "Você tem acesso a ferramentas para ler arquivos na íntegra, fazer buscas nos materiais, editar/criar documentos, ou delegar tarefas para outros sub-agentes.\n\n"
        "### DIRETRIZES DE EXECUÇÃO E APROVAÇÃO (CRÍTICO):\n"
        "1. VOCÊ NÃO TEM AUTORIZAÇÃO PARA EDITAR DIRETAMENTE O DOCUMENTO PRINCIPAL/ATIVO sem aprovação do usuário. Se você usar a ferramenta `write_document` em um documento existente, isso apenas registrará uma proposta de alteração. SE HOUVER QUALQUER CORREÇÃO, MELHORIA OU ALTERAÇÃO DE TEXTO A SER PROPOSTA, VOCÊ DEVE OBRIGATORIAMENTE CHAMAR A FERRAMENTA `write_document` contendo a versão corrigida completa para registrar a proposta pendente (não coloque a alteração apenas por escrito no relatório).\n"
        "2. CONTEXTUALIZE SUA SAÍDA: Em seu relatório final (`finish`), você DEVE contextualizar detalhadamente para o usuário:\n"
        "   - O que está correto e adequado no texto atual do usuário, precedido do marcador `[CORRETO]` (ex: - [CORRETO] O uso das citações está adequado...).\n"
        "   - O que está incorreto ou precisa ser mudado, precedido do marcador `[INCORRETO]` (ex: - [INCORRETO] O parágrafo 3 viola as normas ABNT...).\n"
        "   - Explique detalhadamente cada ponto de melhoria proposto e justifique por que o usuário deve aceitar a alteração.\n"
        "   - Faça isso em formato Markdown estruturado, claro e amigável.\n"
        "3. Você opera em um loop de pensamento-ação. Em cada passo, você analisa o estado da tarefa e decide usar uma ferramenta ou finalizar.\n"
        "4. Você deve responder unicamente com um objeto JSON válido, contendo seu 'thought' e ou um 'tool_call' ou um 'finish'.\n"
        "5. Evite explicações de texto antes ou depois do JSON.\n\n"
        "### REGRAS CRÍTICAS DE FORMATO (JSON):\n"
        "1. Sua resposta deve conter APENAS o JSON puro. Não escreva nenhuma introdução, prefixo (como 'Relatório'), explicação ou markdown antes ou depois do JSON.\n"
        "2. Certifique-se de que o objeto JSON seja sintaticamente correto. Se você incluir aspas duplas no valor de qualquer chave (como 'thought' ou 'report'), você DEVE escapá-las com barra invertida (ex: \\\" no lugar de \") para não corromper o JSON, ou use aspas simples (').\n\n"
        "### FORMATO JSON REQUERIDO:\n"
        "Se você ainda precisa executar ações, use `tool_call`:\n"
        "{\n"
        '  "thought": "Seu raciocínio sobre o estado atual da tarefa e qual a próxima ação.",\n'
        '  "tool_call": {\n'
        '    "name": "nome_da_ferramenta",\n'
        '    "args": { ... }\n'
        '  }\n'
        "}\n\n"
        "Se você concluiu a tarefa e quer dar a resposta final completa e detalhada ao usuário, use `finish`:\n"
        "{\n"
        '  "thought": "Explique por que a tarefa foi concluída.",\n'
        '  "finish": {\n'
        '    "report": "O seu relatório final completo, detalhado, estruturado e aprofundado contendo toda a resposta para a tarefa solicitada."\n'
        '  }\n'
        "}\n\n"
        "### FERRAMENTAS DISPONÍVEIS:\n"
        "- `read_full_material`: Retorna o conteúdo de um material de referência ou modelo pelo nome ou ID.\n"
        "  Parâmetros: `{\"material_id_or_name\": \"...\"}`\n"
        "- `read_full_document`: Retorna o conteúdo de um documento de texto no editor pelo título ou ID.\n"
        "  Parâmetros: `{\"document_id_or_title\": \"...\"}`\n"
        "- `write_document`: Escreve, atualiza ou cria um documento de texto no editor.\n"
        "  Parâmetros: `{\"document_id_or_title\": \"...\", \"content\": \"... novo conteúdo HTML completo ...\"}`\n"
        "- `search_in_materials`: Busca termos ou trechos em todos os materiais do ambiente.\n"
        "  Parâmetros: `{\"query\": \"...\"}`\n"
    )

    # List other agents for delegate_task
    other_agents_str = ""
    for a in all_agents:
        if str(a["id"]) != str(agent_id):
            other_agents_str += f"- {a['name']} (Função: {a['role'] or 'sub-agente'}, ID: {a['id']})\n"

    if other_agents_str:
        system_prompt += (
            "- `delegate_task`: Delega uma subtarefa para outro sub-agente especializado no ambiente e aguarda o seu relatório.\n"
            f"  Sub-agentes disponíveis:\n{other_agents_str}\n"
            "  Parâmetros: `{\"agent_id_or_name\": \"...\", \"task\": \"...\"}`\n"
        )

    # Abbreviated context for starting phase
    references_summary = "\n".join(f"- {m['name']} (ID: {m['id']}) [Tipo: {m['material_type']}]" for m in materials)
    contexts_summary = "\n".join(f"- {c['name']} (ID: {c['id']})" for c in contexts)
    docs_summary = "\n".join(f"- {d['title']} (ID: {d['id']})" for d in all_docs)

    system_prompt += (
        f"\n### SUA INSTANCIAÇÃO/ESPECIALIZAÇÃO:\n{agent_prompt}\n\n"
        "### ARQUIVOS NO AMBIENTE (Use 'read_full_material' ou 'read_full_document' para lê-los):\n"
        f"Materiais de Apoio:\n{references_summary or '(Nenhum)'}\n\n"
        f"Contexto do Projeto:\n{contexts_summary or '(Nenhum)'}\n\n"
        f"Documentos no Editor:\n{docs_summary or '(Nenhum)'}\n"
    )

    history = f"{system_prompt}\n\n### TAREFA A EXECUTAR:\n{task}\n"

    # ReAct execution loop
    final_report = "Tarefa executada."
    
    for step in range(5):
        prompt = f"{history}\n\n### PASSO {step + 1} - Responda com o JSON de thought/tool_call ou finish:\n"
        response_text, err = await generate_text_unified_async(prompt, username=username)
        if err:
            return None, f"Erro ao chamar LLM: {err}"
        
        # Parse JSON
        parsed = parse_agent_json(response_text)
        if not parsed:
            # Fallback: if LLM didn't return JSON, treat the whole response as the final report
            final_report = response_text.strip()
            break
            
        thought = parsed.get("thought", "")
        
        # Check for finish
        if "finish" in parsed:
            finish_data = parsed["finish"]
            final_report = finish_data.get("report", "Tarefa concluída.")
            break
            
        tool_call = parsed.get("tool_call")
        if not tool_call:
            # Fallback if neither finish nor tool_call is present
            final_report = thought or "Tarefa concluída."
            break
            
        tool_name = tool_call.get("name")
        tool_args = tool_call.get("args") or {}
        
        tool_result = ""
        
        # Execute tool
        if tool_name == "read_full_material":
            target = tool_args.get("material_id_or_name")
            matched = None
            for m in materials:
                if str(m["id"]) == str(target) or target.lower() in m["name"].lower():
                    matched = m
                    break
            if matched:
                tool_result = f"Conteúdo do material '{matched['name']}':\n{matched['content_text']}"
            else:
                # Try context matching
                for c in contexts:
                    if str(c["id"]) == str(target) or target.lower() in c["name"].lower():
                        matched = c
                        break
                if matched:
                    tool_result = f"Conteúdo do contexto '{matched['name']}':\n{matched['content_text']}"
                else:
                    tool_result = f"Erro: Material ou Contexto '{target}' não encontrado."
                
        elif tool_name == "read_full_document":
            target = tool_args.get("document_id_or_title")
            matched = None
            for d in all_docs:
                if str(d["id"]) == str(target) or target.lower() in d["title"].lower():
                    matched = d
                    break
            if matched:
                tool_result = f"Conteúdo do documento '{matched['title']}':\n{matched['content']}"
            else:
                tool_result = f"Erro: Documento '{target}' não encontrado."
                
        elif tool_name == "write_document":
            target_title = tool_args.get("document_id_or_title")
            content = tool_args.get("content")
            
            matched = None
            for d in all_docs:
                if str(d["id"]) == str(target_title) or target_title.lower() in d["title"].lower():
                    matched = d
                    break
                    
            if matched:
                pending_proposal = {
                    "document_id": str(matched["id"]),
                    "document_title": matched["title"],
                    "original_content": matched.get("content") or "",
                    "content": content
                }
                tool_result = f"Proposta de alteração do documento '{matched['title']}' registrada com sucesso como pendente de aprovação do usuário. O arquivo principal NÃO foi alterado diretamente. Você DEVE detalhar e contextualizar o que mudou e por que no seu relatório final."
            else:
                new_id = save_writer_document(env_id, None, target_title, content)
                # Refresh docs cache
                all_docs = get_writer_documents(env_id)
                tool_result = f"Documento '{target_title}' criado com sucesso (ID: {new_id})."
                
        elif tool_name == "search_in_materials":
            query = tool_args.get("query", "").lower()
            matches = []
            for m in materials:
                text = m.get("content_text") or ""
                if query in text.lower():
                    # extract simple snippets
                    idx = 0
                    while True:
                        idx = text.lower().find(query, idx)
                        if idx == -1:
                            break
                        start = max(0, idx - 200)
                        end = min(len(text), idx + 200)
                        matches.append(f"[{m['name']}] ... {text[start:end].strip()} ...")
                        idx += len(query)
                        if len(matches) >= 5:
                            break
                if len(matches) >= 5:
                    break
            tool_result = "Resultados da busca:\n" + "\n".join(matches) if matches else "Nenhum resultado encontrado."
            
        elif tool_name == "delegate_task":
            agent_target = tool_args.get("agent_id_or_name")
            sub_task = tool_args.get("task")
            
            matched_agent = None
            for a in all_agents:
                if str(a["id"]) == str(agent_target) or agent_target.lower() in a["name"].lower():
                    matched_agent = a
                    break
                    
            if matched_agent:
                # Log sub-task start
                add_writer_agent_message(matched_agent["id"], "user", f"[Delegado por {agent_name}]: {sub_task}")
                
                # Recursive synchronous execution within background loop
                sub_report, sub_err = await generate_agent_task_response_async(
                    matched_agent["id"], env_id, sub_task, username, depth=depth + 1
                )
                
                if sub_err:
                    sub_report = f"Erro na delegação: {sub_err}"
                
                # Log sub-task end
                add_writer_agent_message(matched_agent["id"], "ai", sub_report)
                
                tool_result = f"Resposta do agente '{matched_agent['name']}':\n{sub_report}"
            else:
                tool_result = f"Erro: Sub-agente '{agent_target}' não encontrado."
                
        else:
            tool_result = f"Erro: Ferramenta '{tool_name}' desconhecida."
            
        # Append to prompt history
        history += f"\nPensamento: {thought}\nAção executada: {tool_name} com args {json.dumps(tool_args)}\nResultado: {tool_result}\n"

    # No truncation to ensure complete detailed reports are preserved
    if pending_proposal:
        payload = {
            "report": final_report,
            "proposal": pending_proposal
        }
        return json.dumps(payload), None

    return final_report, None
