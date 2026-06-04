import os
import uuid
from dotenv import load_dotenv

# Find root .env file
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(root_dir, ".env")
load_dotenv(ENV_PATH, override=True)

# Global client cache
gemini_client = None
image_cache = {}

async def get_or_create_client_async(force_reinit=False):
    global gemini_client
    
    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_api_key:
        return "api_key", None
        
    if gemini_client is not None and not force_reinit:
        return gemini_client, None

    secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
    secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()

    if not secure_1psid or not secure_1psidts:
        gemini_client = None
        return None, "Configuração ausente: defina GEMINI_API_KEY ou os cookies GEMINI_SECURE_1PSID e GEMINI_SECURE_1PSIDTS."

    try:
        from gemini_webapi import GeminiClient
        from gemini_webapi.client import AccountStatus
        print("[Paradise AI] Initializing GeminiClient inside background loop...")
        client = GeminiClient(secure_1psid, secure_1psidts)
        await client.init()
        if client.account_status != AccountStatus.AVAILABLE:
            gemini_client = None
            return None, f"Authentication failed: {client.account_status.description}"
        gemini_client = client
        print("[Paradise AI] Client initialized successfully!")
        return gemini_client, None
    except Exception as e:
        gemini_client = None
        return None, f"Failed to initialize client: {str(e)}"

def enhance_prompt_for_images(message: str) -> str:
    msg_lower = message.lower()
    image_keywords = ["gere uma imagem", "gerar imagem", "crie uma imagem", "criar imagem", "desenhe", "faça um desenho", "generate an image", "create an image", "picture of", "photo of"]
    
    if any(kw in msg_lower for kw in image_keywords):
        enhancement = (
            "\n\n(Important System Instruction for Image Generation: As this is a request to generate an image, "
            "please produce a high-quality, ultra-detailed photorealistic image. Expand the user's request "
            "into a rich, descriptive prompt for your internal ImageFx/Imagen 3 generator. Explicitly request "
            "highly detailed textures, professional cinematic lighting, 8k resolution, photorealism, deep colors, "
            "and award-winning photographic framing. Do not output generic low-resolution, blurred, or illustration-like "
            "styles unless explicitly requested by the user.)"
        )
        return message + enhancement
    return message

async def generate_text_unified_async(prompt):
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
        
    client, err = await get_or_create_client_async()
    if err:
        return None, err
    try:
        response = await client.generate_content(prompt)
        text = response.text if hasattr(response, "text") else str(response)
        return text, None
    except Exception as e:
        return None, str(e)

async def generate_image_unified_async(prompt):
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
            
    client, err = await get_or_create_client_async()
    if err:
        return None, err
    try:
        response = await client.generate_content(prompt)
        if hasattr(response, "images") and response.images:
            for img in response.images:
                if hasattr(img, "url") and img.url:
                    return img.url, None
        return None, "Nenhuma imagem retornada pelo cliente."
    except Exception as e:
        return None, str(e)

async def chat_async(message):
    client, err = await get_or_create_client_async()
    if err:
        return None, err, True

    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if gemini_api_key:
        try:
            from google import genai
            print("[Paradise AI] Using official Gemini API for chat...")
            official_client = genai.Client(api_key=gemini_api_key)
            response = official_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=message
            )
            text = response.text if hasattr(response, "text") else str(response)
            return {"text": text, "images": []}, None, False
        except Exception as e:
            return None, f"Official Gemini API Error: {str(e)}", False

    try:
        # Enhance prompt if it contains image generation requests
        enhanced_message = enhance_prompt_for_images(message)
        response = await client.generate_content(enhanced_message)
        
        # Parse images if any
        images = []
        if hasattr(response, "images") and response.images:
            for img in response.images:
                if hasattr(img, "url") and img.url:
                    images.append(img.url)

        text = response.text if hasattr(response, "text") else str(response)
        return {"text": text, "images": images}, None, False
    except Exception as e:
        error_msg = str(e)
        print(f"[Paradise AI Error] {error_msg}")
        
        needs_config = False
        if "cookie" in error_msg.lower() or "auth" in error_msg.lower() or "401" in error_msg or "403" in error_msg:
            global gemini_client
            gemini_client = None
            needs_config = True
            
        return None, f"An error occurred: {error_msg}", needs_config
