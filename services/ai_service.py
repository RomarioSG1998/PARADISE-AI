import os
import uuid
from dotenv import load_dotenv

# Find root .env file
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(root_dir, ".env")
load_dotenv(ENV_PATH, override=True)

# User-specific client caches
gemini_clients = {}
current_account_ids = {}
image_cache = {}

class G4FClientWrapper:
    def __init__(self, provider_type, account_data):
        self.provider_type = provider_type
        self.account_data = account_data
        
    async def generate_content(self, prompt):
        import g4f
        from g4f.client import AsyncClient
        
        client = AsyncClient()
        provider = None
        model = g4f.models.default
        
        if self.provider_type == "copilot":
            provider = g4f.Provider.Bing
            u_cookie = self.account_data.get("secure_1psid", "")
            if u_cookie:
                try:
                    import g4f.cookies
                    g4f.cookies.set_cookies(".bing.com", {"_U": u_cookie})
                except:
                    pass
                    
        try:
            response = await client.chat.completions.create(
                model=model,
                provider=provider,
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.choices[0].message.content if response.choices else "Empty response"
        except Exception as e:
            content = f"Erro no provedor {self.provider_type.upper()}: {str(e)}"
            
        class MockResponse:
            def __init__(self, text):
                self.text = text
                self.images = []
        return MockResponse(content)

async def get_or_create_client_async(username=None, force_reinit=False, tried_ids=None):
    global gemini_clients, current_account_ids
    
    # Use 'default' if no username provided (e.g. CLI script or public audit logs)
    user_key = username if username else "default"
    
    if tried_ids is None:
        tried_ids = set()
        
    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_api_key:
        return "api_key", None
        
    if gemini_clients.get(user_key) is not None and not force_reinit:
        return gemini_clients[user_key], None

    try:
        from database import get_next_available_account, update_account_status, mark_account_used
    except ImportError:
        import sys
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from database import get_next_available_account, update_account_status, mark_account_used

    # Query active account for this user, falling back to shared active accounts
    account = get_next_available_account(username=username)
    
    # Fallback to .env if no accounts in DB
    if not account:
        secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
        secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
        if not secure_1psid or not secure_1psidts:
            gemini_clients[user_key] = None
            current_account_ids[user_key] = None
            return None, "Configuração ausente: defina GEMINI_API_KEY ou configure uma conta ativa no banco de dados."
        
        # Use .env credentials as virtual account ID 0
        account = {
            "id": 0,
            "name": f"Fallback (.env) for {user_key}",
            "secure_1psid": secure_1psid,
            "secure_1psidts": secure_1psidts
        }

    if account["id"] in tried_ids:
        gemini_clients[user_key] = None
        current_account_ids[user_key] = None
        return None, f"Todas as contas disponíveis para '{user_key}' falharam na autenticação."

    tried_ids.add(account["id"])

    # If provider is GPT or Copilot, use G4F Wrapper
    provider_type = account.get("provider", "gemini")
    if provider_type in ["gpt", "copilot"]:
        gemini_clients[user_key] = G4FClientWrapper(provider_type, account)
        current_account_ids[user_key] = account["id"]
        if account["id"] != 0:
            mark_account_used(account["id"])
        print(f"[Paradise AI] Client for user '{user_key}' initialized via G4F (provider: {provider_type})!")
        return gemini_clients[user_key], None

    try:
        from gemini_webapi import GeminiClient
        from gemini_webapi.client import AccountStatus
        print(f"[Paradise AI] Initializing GeminiClient for '{user_key}' using account '{account['name']}' (ID: {account['id']})...")
        client = GeminiClient(account["secure_1psid"], account["secure_1psidts"])
        await client.init()
        if client.account_status != AccountStatus.AVAILABLE:
            error_msg = f"Authentication failed: {client.account_status.description}"
            print(f"[Paradise AI] Account ID {account['id']} failed check: {error_msg}")
            if account["id"] != 0:
                update_account_status(account["id"], "error", error_msg)
            # Try next account
            return await get_or_create_client_async(username=username, force_reinit=True, tried_ids=tried_ids)
            
        gemini_clients[user_key] = client
        current_account_ids[user_key] = account["id"]
        if account["id"] != 0:
            mark_account_used(account["id"])
        print(f"[Paradise AI] Client for user '{user_key}' using account '{account['name']}' (ID: {account['id']}) initialized successfully!")
        return gemini_clients[user_key], None
    except Exception as e:
        error_msg = str(e)
        print(f"[Paradise AI] Exception during client init for account {account['id']}: {error_msg}")
        if account["id"] != 0:
            update_account_status(account["id"], "error", error_msg)
        # Try next account
        return await get_or_create_client_async(username=username, force_reinit=True, tried_ids=tried_ids)

def enhance_prompt_for_images(message: str) -> str:
    msg_lower = message.lower()
    image_keywords = ["gere uma imagem", "gerar imagem", "crie uma imagem", "criar imagem", "desenhe", "faça um desenho", "generate an image", "create an image", "picture of", "photo of"]
    
    if any(kw in msg_lower for kw in image_keywords):
        enhancement = (
            "\n\n(Important System Instruction for Image Generation: As this is a request to generate an image, "
            "please produce a high-quality, ultra-detailed photorealistic image. Expand the user's request "
            "into a rich and descriptive scene, specifying elements like colors, lighting, art style, and composition "
            "so that the model's image generator output is visually stunning and directly represents the requested scene.)"
        )
        return message + enhancement
    return message

async def generate_text_unified_async(prompt, username=None):
    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    if gemini_api_key:
        from google import genai
        official_client = genai.Client(api_key=gemini_api_key)
        # Use gemini-2.5-flash for text generation tasks
        response = official_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        text = response.text if hasattr(response, "text") else str(response)
        return text, None
        
    client, err = await get_or_create_client_async(username=username)
    if err:
        return None, err
    try:
        response = await client.generate_content(prompt)
        text = response.text if hasattr(response, "text") else str(response)
        return text, None
    except Exception as e:
        return None, str(e)

async def generate_image_unified_async(prompt, username=None):
    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    if gemini_api_key:
        try:
            from google import genai
            official_client = genai.Client(api_key=gemini_api_key)
            print(f"[Paradise AI] Generating image via Imagen 3: {prompt}")
            result = official_client.models.generate_images(
                model='imagen-3.0-generate-002',
                prompt=prompt,
                config=dict(
                    number_of_images=1,
                    output_mime_type="image/jpeg"
                )
            )
            if result.generated_images:
                img_bytes = result.generated_images[0].image.image_bytes
                img_id = str(uuid.uuid4())
                image_cache[img_id] = img_bytes
                return f"/api/image-cache/{img_id}", None
            return None, "Nenhuma imagem foi retornada pelo modelo Imagen 3."
        except Exception as e:
            return None, f"Erro de geração de imagem oficial: {str(e)}"
            
    client, err = await get_or_create_client_async(username=username)
    if err:
        return None, err

    if isinstance(client, G4FClientWrapper):
        try:
            import urllib.parse
            import urllib.request
            import io
            from g4f.client import AsyncClient
            import g4f.Provider
            g4f_client = AsyncClient()

            # Injetar hint de proporção 16:9 no prompt para qualquer provedor G4F
            widescreen_hint = "widescreen 16:9 cinematic horizontal landscape format, ultra-wide composition"
            prompt_16x9 = f"{prompt}, {widescreen_hint}"

            if client.provider_type == "copilot" and client.account_data.get("secure_1psid"):
                import g4f.cookies
                g4f.cookies.set_cookies(".bing.com", {"_U": client.account_data["secure_1psid"]})
                # DALL-E 3 suporta size="1792x1024" que é aprox. 16:9
                try:
                    img_response = await g4f_client.images.generate(
                        model='dall-e-3', prompt=prompt_16x9, size="1792x1024"
                    )
                except Exception:
                    # Fallback sem parâmetro size se o provedor não suportar
                    img_response = await g4f_client.images.generate(
                        model='dall-e-3', prompt=prompt_16x9
                    )
            else:
                # OperaAria/Flux — tenta com width/height 16:9
                try:
                    img_response = await g4f_client.images.generate(
                        model='flux', prompt=prompt_16x9,
                        provider=g4f.Provider.OperaAria,
                        width=1280, height=720
                    )
                except Exception:
                    # Fallback sem parâmetros de dimensão
                    img_response = await g4f_client.images.generate(
                        model='flux', prompt=prompt_16x9, provider=g4f.Provider.OperaAria
                    )

            if img_response and img_response.data:
                raw_url = img_response.data[0].url
                # Extrair URL real se vier encapsulada em parâmetro de query
                if 'url=' in raw_url:
                    parsed = urllib.parse.urlparse(raw_url)
                    query = urllib.parse.parse_qs(parsed.query)
                    actual_url = query.get('url', [raw_url])[0]
                else:
                    actual_url = raw_url

                # Fazer download e normalizar para 1280x720 (16:9) com Pillow
                try:
                    req = urllib.request.Request(actual_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        raw_bytes = resp.read()

                    # Redimensionar/cortar para 16:9 exato (mesmo padrão do Gemini)
                    try:
                        from PIL import Image as PILImage
                        pil_img = PILImage.open(io.BytesIO(raw_bytes)).convert("RGB")
                        target_w, target_h = 1280, 720
                        src_w, src_h = pil_img.size
                        src_ratio = src_w / src_h
                        target_ratio = target_w / target_h

                        if abs(src_ratio - target_ratio) > 0.05:
                            # Escalar para cobrir o target mantendo proporção original
                            if src_ratio > target_ratio:
                                # Mais largo: ajustar pela altura e cortar largura
                                new_h = target_h
                                new_w = int(src_w * (target_h / src_h))
                            else:
                                # Mais alto: ajustar pela largura e cortar altura
                                new_w = target_w
                                new_h = int(src_h * (target_w / src_w))
                            pil_img = pil_img.resize((new_w, new_h), PILImage.LANCZOS)
                            # Crop central para 1280x720
                            left = (new_w - target_w) // 2
                            top = (new_h - target_h) // 2
                            pil_img = pil_img.crop((left, top, left + target_w, top + target_h))
                        else:
                            pil_img = pil_img.resize((target_w, target_h), PILImage.LANCZOS)

                        buf = io.BytesIO()
                        pil_img.save(buf, format="JPEG", quality=90)
                        img_bytes = buf.getvalue()
                        print(f"[Paradise AI] G4F image normalized to 1280x720 (16:9)")
                    except ImportError:
                        # Pillow não disponível — usa bytes originais
                        img_bytes = raw_bytes
                        print(f"[Paradise AI] Pillow not available, storing raw G4F image bytes")

                    img_id = str(uuid.uuid4())
                    image_cache[img_id] = img_bytes
                    print(f"[Paradise AI] G4F image cached locally as /api/image-cache/{img_id}")
                    return f"/api/image-cache/{img_id}", None
                except Exception as dl_err:
                    print(f"[Paradise AI] Warning: could not download G4F image, returning raw URL. Error: {dl_err}")
                    return actual_url, None

            return None, "O provedor gratuito de imagem não retornou um link válido."
        except Exception as e:
            return None, f"Erro ao gerar imagem via G4F (OperaAria/DALL-E): {str(e)}"

    try:
        response = await client.generate_content(prompt)
        if hasattr(response, "images") and response.images:
            for img in response.images:
                if hasattr(img, "url") and img.url:
                    return img.url, None
        return None, "Nenhuma imagem retornada pelo cliente."
    except Exception as e:
        return None, str(e)
