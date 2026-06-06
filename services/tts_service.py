import os
import io
import wave
from dotenv import load_dotenv

# Find root .env file
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(root_dir, ".env")
load_dotenv(ENV_PATH, override=True)

async def generate_official_gemini_tts_async(text: str, api_key: str) -> tuple[bytes, str]:
    from google import genai
    from google.genai import types
    
    client = genai.Client(api_key=api_key)
    
    # We choose "Puck" as the native Gemini male assistant voice (highly natural)
    config = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Puck"
                )
            )
        )
    )
    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"Leia este texto com a entonação correta do robô: {text}",
        config=config
    )
    
    audio_bytes = b""
    mime_type = "audio/wav"
    
    if response.candidates and response.candidates[0].content.parts:
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                if part.inline_data.data:
                    audio_bytes += part.inline_data.data
                if part.inline_data.mime_type:
                    mime_type = part.inline_data.mime_type
                    
    return audio_bytes, mime_type

def pcm_to_wav(pcm_data, sample_rate=24000, num_channels=1, sample_width=2):
    wav_buf = io.BytesIO()
    with wave.open(wav_buf, 'wb') as wav_file:
        wav_file.setnchannels(num_channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    wav_buf.seek(0)
    return wav_buf.read()

async def generate_edge_tts_async(text: str, lang_code: str = "pt") -> bytes:
    import edge_tts
    if lang_code == "en":
        voice = "en-US-EmmaNeural"
    elif lang_code == "es":
        voice = "es-ES-ElviraNeural"
    else:
        # AntonioNeural matches a premium BR assistant
        voice = "pt-BR-AntonioNeural"
        
    communicate = edge_tts.Communicate(text, voice)
    data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            data += chunk["data"]
    return data


def sanitize_tts_text(text: str, lang_code: str = "pt") -> str:
    import re
    
    # 1. Strip wrap dollar signs
    text = text.replace("$", " ")
    text = re.sub(r'\s+', ' ', text)

    # 2. LaTeX macro replacements depending on language
    replacements = {
        "pt": [
            # Fractions: \frac{a}{b} -> a sobre b
            (r'\\frac\s*\{\s*([^{}]+)\s*\}\s*\{\s*([^{}]+)\s*\}', r'\1 sobre \2'),
            # Square root: \sqrt{x} -> raiz quadrada de x
            (r'\\sqrt\s*\{\s*([^{}]+)\s*\}', r'raiz quadrada de \1'),
            (r'\\sqrt\s*([a-zA-Z0-9])', r'raiz quadrada de \1'),
            # Nth root: \sqrt[n]{x} -> raiz n de x
            (r'\\sqrt\s*\[\s*([^\]]+)\s*\]\s*\{\s*([^{}]+)\s*\}', r'raiz \1 de \2'),
            # Superscripts
            (r'(\w+)\s*\^\s*\{\s*([^}]+)\s*\}', r'\1 elevado a \2'),
            (r'(\w+)\s*\^\s*2\b', r'\1 ao quadrado'),
            (r'(\w+)\s*\^\s*3\b', r'\1 ao cubo'),
            (r'(\w+)\s*\^\s*([0-9a-zA-Z])', r'\1 elevado a \2'),
            # Subscripts
            (r'(\w+)\s*_\s*\{\s*([^}]+)\s*\}', r'\1 sub \2'),
            (r'(\w+)\s*_\s*([0-9a-zA-Z])', r'\1 sub \2'),
            # Math symbols
            (r'\\times', ' vezes '),
            (r'\\cdot', ' vezes '),
            (r'\\div', ' dividido por '),
            (r'\\pm', ' mais ou menos '),
            (r'\\neq', ' diferente de '),
            (r'\\approx', ' aproximadamente igual a '),
            (r'\\leq', ' menor ou igual a '),
            (r'\\geq', ' maior ou igual a '),
            (r'\\le\b', ' menor ou igual a '),
            (r'\\ge\b', ' maior ou igual a '),
            (r'\\infty', ' infinito '),
            (r'\\pi', ' pi '),
            (r'\\theta', ' teta '),
            (r'\\alpha', ' alfa '),
            (r'\\beta', ' beta '),
            (r'\\gamma', ' gama '),
            (r'\\Delta', ' delta '),
            (r'\\sum', ' somatório de '),
            (r'\\int', ' integral de '),
            (r'\\lim', ' limite '),
            (r'\\log', ' logaritmo '),
            (r'\\ln', ' logaritmo natural '),
            (r'\\sin', ' seno '),
            (r'\\sen', ' seno '),
            (r'\\cos', ' cosseno '),
            (r'\\tan', ' tangente '),
            (r'\\to', ' tende a '),
            (r'\\rightarrow', ' tende a '),
            (r'\\[a-zA-Z]+', ' '),
            (r'[\{\}]', ' '),
        ],
        "en": [
            # Fractions: \frac{a}{b} -> a over b
            (r'\\frac\s*\{\s*([^{}]+)\s*\}\s*\{\s*([^{}]+)\s*\}', r'\1 over \2'),
            # Square root: \sqrt{x} -> square root of x
            (r'\\sqrt\s*\{\s*([^{}]+)\s*\}', r'square root of \1'),
            (r'\\sqrt\s*([a-zA-Z0-9])', r'square root of \1'),
            # Nth root: \sqrt[n]{x} -> nth root of x
            (r'\\sqrt\s*\[\s*([^\]]+)\s*\]\s*\{\s*([^{}]+)\s*\}', r'\1 root of \2'),
            # Superscripts
            (r'(\w+)\s*\^\s*\{\s*([^}]+)\s*\}', r'\1 to the power of \2'),
            (r'(\w+)\s*\^\s*2\b', r'\1 squared'),
            (r'(\w+)\s*\^\s*3\b', r'\1 cubed'),
            (r'(\w+)\s*\^\s*([0-9a-zA-Z])', r'\1 to the power of \2'),
            # Subscripts
            (r'(\w+)\s*_\s*\{\s*([^}]+)\s*\}', r'\1 sub \2'),
            (r'(\w+)\s*_\s*([0-9a-zA-Z])', r'\1 sub \2'),
            # Math symbols
            (r'\\times', ' times '),
            (r'\\cdot', ' times '),
            (r'\\div', ' divided by '),
            (r'\\pm', ' plus or minus '),
            (r'\\neq', ' not equal to '),
            (r'\\approx', ' approximately equal to '),
            (r'\\leq', ' less than or equal to '),
            (r'\\geq', ' greater than or equal to '),
            (r'\\le\b', ' less than or equal to '),
            (r'\\ge\b', ' greater than or equal to '),
            (r'\\infty', ' infinity '),
            (r'\\pi', ' pi '),
            (r'\\theta', ' theta '),
            (r'\\alpha', ' alpha '),
            (r'\\beta', ' beta '),
            (r'\\gamma', ' gamma '),
            (r'\\Delta', ' delta '),
            (r'\\sum', ' sum of '),
            (r'\\int', ' integral of '),
            (r'\\lim', ' limit '),
            (r'\\log', ' log '),
            (r'\\ln', ' natural log '),
            (r'\\sin', ' sine '),
            (r'\\sen', ' sine '),
            (r'\\cos', ' cosine '),
            (r'\\tan', ' tangent '),
            (r'\\to', ' goes to '),
            (r'\\rightarrow', ' goes to '),
            (r'\\[a-zA-Z]+', ' '),
            (r'[\{\}]', ' '),
        ],
        "es": [
            # Fractions: \frac{a}{b} -> a partido por b
            (r'\\frac\s*\{\s*([^{}]+)\s*\}\s*\{\s*([^{}]+)\s*\}', r'\1 partido por \2'),
            # Square root: \sqrt{x} -> raíz cuadrada de x
            (r'\\sqrt\s*\{\s*([^{}]+)\s*\}', r'raíz cuadrada de \1'),
            (r'\\sqrt\s*([a-zA-Z0-9])', r'raíz cuadrada de \1'),
            # Nth root: \sqrt[n]{x} -> raíz n-ésima de x
            (r'\\sqrt\s*\[\s*([^\]]+)\s*\]\s*\{\s*([^{}]+)\s*\}', r'raíz \1 de \2'),
            # Superscripts
            (r'(\w+)\s*\^\s*\{\s*([^}]+)\s*\}', r'\1 elevado a \2'),
            (r'(\w+)\s*\^\s*2\b', r'\1 al cuadrado'),
            (r'(\w+)\s*\^\s*3\b', r'\1 al cubo'),
            (r'(\w+)\s*\^\s*([0-9a-zA-Z])', r'\1 elevado a \2'),
            # Subscripts
            (r'(\w+)\s*_\s*\{\s*([^}]+)\s*\}', r'\1 sub \2'),
            (r'(\w+)\s*_\s*([0-9a-zA-Z])', r'\1 sub \2'),
            # Math symbols
            (r'\\times', ' por '),
            (r'\\cdot', ' por '),
            (r'\\div', ' dividido por '),
            (r'\\pm', ' más o menos '),
            (r'\\neq', ' diferente de '),
            (r'\\approx', ' aproximadamente igual a '),
            (r'\\leq', ' menor o igual a '),
            (r'\\geq', ' mayor o igual a '),
            (r'\\le\b', ' menor o igual a '),
            (r'\\ge\b', ' mayor o igual a '),
            (r'\\infty', ' infinito '),
            (r'\\pi', ' pi '),
            (r'\\theta', ' teta '),
            (r'\\alpha', ' alfa '),
            (r'\\beta', ' beta '),
            (r'\\gamma', ' gama '),
            (r'\\Delta', ' delta '),
            (r'\\sum', ' suma de '),
            (r'\\int', ' integral de '),
            (r'\\lim', ' límite '),
            (r'\\log', ' logaritmo '),
            (r'\\ln', ' logaritmo natural '),
            (r'\\sin', ' seno '),
            (r'\\sen', ' seno '),
            (r'\\cos', ' coseno '),
            (r'\\tan', ' tangente '),
            (r'\\to', ' tiende a '),
            (r'\\rightarrow', ' tiende a '),
            (r'\\[a-zA-Z]+', ' '),
            (r'[\{\}]', ' '),
        ]
    }

    rules = replacements.get(lang_code, replacements["pt"])
    for pattern, repl in rules:
        text = re.sub(pattern, repl, text)

    text = text.replace("^", " elevado a ")
    text = re.sub(r'\s+', ' ', text).strip()
    return text

