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
