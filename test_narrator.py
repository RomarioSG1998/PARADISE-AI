import sys
import os
import asyncio

# Append application path
sys.path.append("/app")

from services.narrative_service import generate_narrative_async

async def main():
    print("Testing generate_narrative_async...")
    try:
        data = await generate_narrative_async(
            content="Uma pequena floresta encantada com cogumelos azuis brilhantes e uma coruja sábia.",
            genre="fantasia",
            duration_min=1,
            voice_id="pt-BR-AntonioNeural"
        )
        print("Success! Generated narrative data:")
        import json
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error during generation: {e}")

if __name__ == "__main__":
    asyncio.run(main())
