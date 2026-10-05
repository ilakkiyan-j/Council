import os
import sys
import asyncio
from pathlib import Path
from sofi_stt import sofi_stt
from sofi_tts import sofi_voice

async def process_voice_conversation(input_audio_path: str, output_audio_path: str = None) -> dict:
    """
    Complete Voice Round-Trip:
    1. STT: Transcribe user's audio input.
    2. Simulated/Gemini Brain Hook: Generate conversational reply.
    3. TTS: Synthesize speech in Sofi's locked voice.
    """
    print("=" * 60)
    print("  SOFI VOICE CONVERSATION ROUND-TRIP")
    print("=" * 60)

    # Step 1: Transcribe Input Voice
    print(f"[*] Transcribing input audio: {input_audio_path}...")
    user_text = sofi_stt.transcribe(input_audio_path)
    print(f"    [User Said]: \"{user_text}\"")

    # Step 2: Response (Hook for Gemini / Council Brain)
    # E.g., when integrated, this calls your Gemini endpoint
    reply_text = f"I heard you say: {user_text}. I'm on it right now, Ilakkiyan!"
    print(f"\n[*] Generated Reply: \"{reply_text}\"")

    # Step 3: Synthesize Locked Voice
    if not output_audio_path:
        output_audio_path = str(Path(__file__).parent / "output" / "sofi_voice_response.mp3")
        
    print(f"[*] Synthesizing response with Sofi's locked voice...")
    result_file = await sofi_voice.synthesize(reply_text, output_audio_path)
    print(f"    [OK] Voice reply ready at: {result_file}")
    
    return {
        "user_text": user_text,
        "reply_text": reply_text,
        "audio_path": result_file
    }

if __name__ == "__main__":
    test_audio = "d:/Projects/0-OS/Council/voice/output/sofi_synth_1_greeting.wav"
    if os.path.exists(test_audio):
        asyncio.run(process_voice_conversation(test_audio))
