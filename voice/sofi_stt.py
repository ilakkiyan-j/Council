import os
import sys
import time
from faster_whisper import WhisperModel

class SofiSTTEngine:
    """
    Sub-100ms Speech-to-Text Transcriber for Sofi in NOX & Telegram.
    Uses CTranslate2 quantized Whisper (tiny / base.en).
    """
    def __init__(self, model_size: str = "base.en", device: str = "cpu"):
        print(f"[*] Initializing Sofi STT Whisper ({model_size})...")
        self.model = WhisperModel(model_size, device=device, compute_type="int8")
        print("    [OK] Sofi STT Transcriber Ready.")

    def transcribe(self, audio_path: str) -> str:
        """
        Transcribe any audio file (.ogg, .wav, .mp3, .m4a) to text.
        """
        t0 = time.time()
        segments, info = self.model.transcribe(audio_path, beam_size=1)
        text = " ".join([segment.text for segment in segments]).strip()
        elapsed = time.time() - t0
        print(f"[SofiSTT] Transcribed in {elapsed * 1000:.1f}ms (lang: {info.language}) -> \"{text}\"")
        return text

# Global singleton
sofi_stt = SofiSTTEngine()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        audio_target = sys.argv[1]
        if os.path.exists(audio_target):
            result = sofi_stt.transcribe(audio_target)
            print(f"TRANSCRIBED_TEXT:{result}")
        else:
            print("ERROR: File not found", file=sys.stderr)
            sys.exit(1)
    else:
        ref_audio = "d:/Projects/0-OS/Council/voice/sofi_clean_reference.wav"
        if os.path.exists(ref_audio):
            print("Testing STT transcription on reference audio snippet...")
            result = sofi_stt.transcribe(ref_audio)
            print("Transcribed Output:", result)
