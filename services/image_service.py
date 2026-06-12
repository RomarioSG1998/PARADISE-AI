"""
services/image_service.py
Handles all image generation logic (Imagen 3 via official API and G4F fallback).
Exposes a shared `image_cache` dict used by the /api/image-cache/<id> route.
"""
import uuid
import os

# Shared in-memory image byte cache (keyed by UUID string)
image_cache: dict[str, bytes] = {}


async def generate_image_unified_async(prompt: str, username: str = None, output_format: str = "youtube"):
    from dotenv import load_dotenv
    from services.ai_service import get_or_create_client_async, G4FClientWrapper, ENV_PATH

    load_dotenv(ENV_PATH, override=True)
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if gemini_api_key:
        try:
            from google import genai
            official_client = genai.Client(api_key=gemini_api_key)
            print(f"[Paradise AI] Generating image via Imagen 3: {prompt}")
            aspect_ratio = "16:9" if output_format == "youtube" else "9:16"
            result = official_client.models.generate_images(
                model="imagen-3.0-generate-002",
                prompt=prompt,
                config=dict(
                    number_of_images=1,
                    output_mime_type="image/jpeg",
                    aspect_ratio=aspect_ratio,
                ),
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
        return await _generate_via_g4f(client, prompt, output_format)

    # Fallback: Gemini Web API image generation
    try:
        response = await client.generate_content(prompt)
        if hasattr(response, "images") and response.images:
            for img in response.images:
                if hasattr(img, "url") and img.url:
                    return img.url, None
        return None, "Nenhuma imagem retornada pelo cliente."
    except Exception as e:
        return None, str(e)


async def _generate_via_g4f(client, prompt: str, output_format: str):
    import urllib.parse
    import urllib.request
    import io
    from g4f.client import AsyncClient
    import g4f.Provider

    g4f_client = AsyncClient()

    if output_format == "stories":
        format_hint = "vertical 9:16 smartphone portrait format, tall vertical composition"
        target_w, target_h = 720, 1280
    else:
        format_hint = "widescreen 16:9 cinematic horizontal landscape format, ultra-wide composition"
        target_w, target_h = 1280, 720

    prompt_formatted = f"{prompt}, {format_hint}"

    img_response = None
    if client.provider_type == "copilot" and client.account_data.get("secure_1psid"):
        import g4f.cookies
        g4f.cookies.set_cookies(".bing.com", {"_U": client.account_data["secure_1psid"]})
        size_str = "1024x1792" if output_format == "stories" else "1792x1024"
        try:
            img_response = await g4f_client.images.generate(model="dall-e-3", prompt=prompt_formatted, size=size_str)
        except Exception:
            img_response = await g4f_client.images.generate(model="dall-e-3", prompt=prompt_formatted)
    else:
        try:
            img_response = await g4f_client.images.generate(
                model="flux", prompt=prompt_formatted, provider=g4f.Provider.OperaAria,
                width=target_w, height=target_h
            )
        except Exception:
            img_response = await g4f_client.images.generate(
                model="flux", prompt=prompt_formatted, provider=g4f.Provider.OperaAria
            )

    if not img_response or not img_response.data:
        return None, "O provedor gratuito de imagem não retornou um link válido."

    raw_url = img_response.data[0].url
    if "url=" in raw_url:
        parsed = urllib.parse.urlparse(raw_url)
        query = urllib.parse.parse_qs(parsed.query)
        actual_url = query.get("url", [raw_url])[0]
    else:
        actual_url = raw_url

    try:
        req = urllib.request.Request(actual_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw_bytes = resp.read()

        img_bytes = _normalize_image(raw_bytes, target_w, target_h)
        img_id = str(uuid.uuid4())
        image_cache[img_id] = img_bytes
        print(f"[Paradise AI] G4F image cached locally as /api/image-cache/{img_id}")
        return f"/api/image-cache/{img_id}", None
    except Exception as dl_err:
        print(f"[Paradise AI] Warning: could not download G4F image. Error: {dl_err}")
        return actual_url, None


def _normalize_image(raw_bytes: bytes, target_w: int, target_h: int) -> bytes:
    try:
        import io
        from PIL import Image as PILImage
        pil_img = PILImage.open(io.BytesIO(raw_bytes)).convert("RGB")
        src_w, src_h = pil_img.size
        src_ratio = src_w / src_h
        target_ratio = target_w / target_h

        if abs(src_ratio - target_ratio) > 0.05:
            if src_ratio > target_ratio:
                new_h = target_h
                new_w = int(src_w * (target_h / src_h))
            else:
                new_w = target_w
                new_h = int(src_h * (target_w / src_w))
            pil_img = pil_img.resize((new_w, new_h), PILImage.LANCZOS)
            left = (new_w - target_w) // 2
            top = (new_h - target_h) // 2
            pil_img = pil_img.crop((left, top, left + target_w, top + target_h))
        else:
            pil_img = pil_img.resize((target_w, target_h), PILImage.LANCZOS)

        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=90)
        print(f"[Paradise AI] G4F image normalized to {target_w}x{target_h}")
        return buf.getvalue()
    except ImportError:
        print("[Paradise AI] Pillow not available, storing raw G4F image bytes")
        return raw_bytes
