# 📑 Documentação Oficial: Paradise AI Hub Portal (V2)

Este portal unificado serve como a central de ferramentas inteligentes alimentadas pelo Gemini Advanced Pro. Em vez de utilizar chaves de API técnicas ou gateways complexos, o Hub oferece uma experiência de portal de aplicativos com compartilhamento de sessão e bypass de créditos.

---

## 🛠️ Arquitetura do Hub (V2)

O Hub está estruturado sob os seguintes pilares:
*   **Acesso do Portal:** `http://localhost:5000/` (Dashboard com os apps disponíveis e configuração unificada).
*   **Chat Advanced Pro:** `http://localhost:5000/chat` (Primeiro aplicativo operacional de chat conversacional e geração de mídia).
*   **Sessão Unificada (.env):** Os cookies de sessão da conta Google One Premium são compartilhados de forma transparente por todos os aplicativos do Hub.

---

## 🔑 Como Configurar os Cookies de Sessão

Os cookies do Gemini Advanced são gerenciados e persistidos no arquivo `.env` do backend. Para configurá-los:

1. Acesse [gemini.google.com](https://gemini.google.com) usando o navegador com a conta assinante logada.
2. Pressione **F12** -> vá na aba **Application** (Chrome/Edge) ou **Armazenamento** (Firefox) -> expanda **Cookies** -> clique em `https://gemini.google.com`.
3. Copie os valores completos de:
    *   `__Secure-1PSID` (hash longo terminado em ponto).
    *   `__Secure-1PSIDTS` (contém informações de sincronização temporal).
4. Insira os valores no formulário de configuração no topo do portal do Hub (`/`). O servidor validará os cookies e reiniciará a sessão automaticamente no backend.

---

## 🖼️ Método de Proxy Autenticado para Imagens (Solução Definitiva)

Ao gerar imagens no Gemini Pro (via Imagen 3 / ImageFx), os navegadores modernos costumam bloquear o carregamento direto das URLs do Google (`googleusercontent.com` ou `work.fife.usercontent.google.com`) no chat local por motivos de segurança, exibindo o erro `ERR_BLOCKED_BY_RESPONSE.NotSameSite` (Cross-Origin Resource Policy / Same-Site).

Para solucionar isto de forma robusta e definitiva, criamos o **Método de Proxy Autenticado**:

### 1. O Endpoint de Proxy no Backend (`app.py`)
O backend do Flask atua como um intermediador de mídia que faz o download da imagem enviando os cookies ativos de sessão do usuário, garantindo a autorização na CDN privada do Google:

```python
@app.route("/api/proxy-image")
def proxy_image():
    import requests
    from urllib.parse import urlparse
    from flask import Response
    
    url = request.args.get("url")
    if not url:
        return "URL is required", 400
        
    parsed = urlparse(url)
    if not any(domain in parsed.netloc for domain in ["googleusercontent.com", "google.com"]):
        return "Forbidden domain", 403

    try:
        # Carrega os cookies ativos do .env para autenticar a requisição perante a CDN do Google
        load_dotenv(ENV_PATH)
        secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
        secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
        
        cookies = {}
        if secure_1psid and secure_1psidts:
            cookies = {
                "__Secure-1PSID": secure_1psid,
                "__Secure-1PSIDTS": secure_1psidts
            }

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
        }
        resp = requests.get(url, headers=headers, cookies=cookies, timeout=25)
        if resp.status_code != 200:
            return f"Failed to fetch image", 502
            
        content_type = resp.headers.get("Content-Type", "image/png")
        return Response(resp.content, mimetype=content_type)
    except Exception as e:
        return f"Error: {str(e)}", 500
```

### 2. O Renderizador Customizado de Markdown (`chat.html`)
Para processar os links das imagens geradas no meio do texto e apontar para o proxy, utilizamos a biblioteca **`marked.js` pinned na versão `4.3.0`** (garantindo estabilidade de argumentos) configurando um renderizador de imagem customizado com `referrerpolicy="no-referrer"`:

```javascript
// Helper para mapear URLs para o proxy local
function getProxyUrl(url) {
    if (url && (url.includes("googleusercontent.com") || url.includes("google.com"))) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
}

// Customização do marked.js
const renderer = new marked.Renderer();
renderer.image = function(href, title, text) {
    const proxyHref = getProxyUrl(href);
    return `<div class="output-img-container" style="max-width: 400px; margin-top: 0.75rem;">
        <img src="${proxyHref}" alt="${text || 'Imagem'}" title="${title || ''}" referrerpolicy="no-referrer" onclick="window.open('${href}', '_blank')" />
        <a href="${proxyHref}" download="gemini-output.png" target="_blank" class="img-download-btn"><i class="fa-solid fa-download"></i></a>
    </div>`;
};
```

### 3. Filtro de Duplicidade
Como o Gemini retorna os links no texto de chat (em Markdown) e também no array de mídias (`images`), o JavaScript do chat varre o array e só renderiza novas mídias se elas não constarem no corpo do chat já renderizado:

```javascript
images.forEach(imgUrl => {
    if (!bubbleDiv.innerHTML.includes(imgUrl)) {
        // Renderiza apenas se não existir duplicidade no texto
    }
});
```

---

## ⚡ Monitoramento e Ajustes
*   **Template Auto-Reload & Cache Busting:** O servidor Python está configurado com `app.config['TEMPLATES_AUTO_RELOAD'] = True` e injeta cabeçalhos HTTP de controle de cache (`no-cache`, `no-store`) para garantir que qualquer modificação visual no painel seja refletida instantaneamente sem cache obsoleto do navegador.
