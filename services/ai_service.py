"""
services/ai_service.py
Core AI client management and text generation.
Image generation has been moved to services/image_service.py.
"""
import os
import uuid
from dotenv import load_dotenv

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(root_dir, ".env")
load_dotenv(ENV_PATH, override=True)

# User-specific client caches
gemini_clients = {}
current_account_ids = {}

# Kept for backward compatibility — real cache lives in image_service.py
from services.image_service import image_cache


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
                except Exception:
                    pass

        try:
            response = await client.chat.completions.create(
                model=model,
                provider=provider,
                messages=[{"role": "user", "content": prompt}],
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

    account = get_next_available_account(username=username)

    if not account:
        secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
        secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
        if not secure_1psid or not secure_1psidts:
            gemini_clients[user_key] = None
            current_account_ids[user_key] = None
            return None, "Configuração ausente: defina GEMINI_API_KEY ou configure uma conta ativa no banco de dados."
        account = {
            "id": 0,
            "name": f"Fallback (.env) for {user_key}",
            "secure_1psid": secure_1psid,
            "secure_1psidts": secure_1psidts,
        }

    if account["id"] in tried_ids:
        gemini_clients[user_key] = None
        current_account_ids[user_key] = None
        return None, f"Todas as contas disponíveis para '{user_key}' falharam na autenticação."

    tried_ids.add(account["id"])

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
        return await get_or_create_client_async(username=username, force_reinit=True, tried_ids=tried_ids)


def enhance_prompt_for_images(message: str) -> str:
    msg_lower = message.lower()
    image_keywords = [
        "gere uma imagem", "gerar imagem", "crie uma imagem", "criar imagem",
        "desenhe", "faça um desenho", "generate an image", "create an image",
        "picture of", "photo of",
    ]
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
        response = official_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
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


async def generate_image_unified_async(prompt, username=None, output_format="youtube"):
    """Thin wrapper — real implementation lives in services/image_service.py."""
    from services.image_service import generate_image_unified_async as _gen
    return await _gen(prompt, username=username, output_format=output_format)
